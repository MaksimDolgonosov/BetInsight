import "server-only";
import { budgetSnapshot, canSpend, startOfUtcMonth } from "@/server/budget/budget";
import { getAdminStore } from "@/server/admin/store";
import type { TestStreamEvent } from "@/server/admin/test-events";
import { evaluateQuotes } from "@/server/domain/odds/evaluate";
import type { Market, SportGroup } from "@/server/domain/settings";
import { fetchLeagueOdds, oddsApiMode } from "@/server/integrations/odds-api/client";
import type { OddsEvent } from "@/server/integrations/odds-api/schema";
import { generatePrediction } from "@/server/integrations/openrouter/generate";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const AI_EVENT_CAP = 3;

export async function startTestRun(input: {
  sportKey: string;
  markets: Market[];
  actor: string;
}): Promise<{ stream: ReadableStream<Uint8Array> } | { error: string; status: number }> {
  const store = getAdminStore();
  const settings = await store.getSettings();
  const league = settings.leagues.find((item) => item.key === input.sportKey && item.enabled);
  if (!league || input.markets.length === 0 || input.markets.some((market) => !settings.markets.includes(market))) {
    return { error: "invalid", status: 400 };
  }

  const mocked = oddsApiMode() === "mock";
  const estimatedCost = mocked ? 0 : input.markets.length;
  const now = new Date();
  const usage = await store.listApiUsageSince(startOfUtcMonth(now));
  const snapshot = budgetSnapshot({
    monthlyLimit: settings.monthlyCreditLimit,
    reserveCredits: settings.reserveCredits,
    used: usage.reduce((sum, row) => sum + row.cost, 0),
    now,
  });
  const budget = canSpend(snapshot, estimatedCost, "other");
  if (!budget.ok) return { error: budget.reason, status: 409 };
  if (!mocked && !process.env.ODDS_API_KEY) return { error: "missing_odds_key", status: 400 };
  if (settings.llmModel.endsWith(":free") && process.env.VERCEL_ENV === "production") {
    return { error: "free_model", status: 400 };
  }

  const redis = await redisAllowance(settings.testRunsPerDay);
  if (redis === "interval" || redis === "daily") return { error: redis, status: 429 };

  const reserved = await store.reserveTestRun({
    now,
    dailyLimit: settings.testRunsPerDay,
    actor: input.actor,
  });
  if (!reserved.ok) return { error: reserved.reason, status: 429 };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TestStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const result = await fetchLeagueOdds({
          sportKey: league.key,
          region: settings.region,
          markets: input.markets,
        });
        const cost = result.mocked ? 0 : result.ok ? (result.lastCost ?? estimatedCost) : (result.lastCost ?? 0);
        await store.recordApiUsage({
          endpoint: `GET /v4/sports/${league.key}/odds`,
          params: {
            region: settings.region,
            markets: input.markets,
            httpStatus: result.httpStatus,
            mocked: result.mocked,
            lastCost: result.lastCost,
          },
          cost,
          remaining: result.remaining,
          used: result.used,
          source: "test",
        });

        send({
          type: "odds",
          httpStatus: result.httpStatus,
          latencyMs: result.latencyMs,
          remaining: result.remaining,
          used: result.used,
          lastCost: result.lastCost,
          mocked: result.mocked,
          raw: result.raw,
          table: result.events.map(summarizeEvent),
          valid: result.valid,
        });

        if (!result.ok) {
          send({ type: "error", code: result.error ?? "odds_failed" });
          send({ type: "done" });
          return;
        }

        const thresholds = settings.thresholds[league.group];
        const modelRows = result.events.flatMap((event) =>
          evaluateQuotes(event.quotes, thresholds).map((row) => ({
            ...row,
            eventId: event.id,
            home: event.home,
            away: event.away,
            commenceTime: event.commenceTime,
          })),
        );
        send({ type: "model", rows: modelRows });

        if (!process.env.OPENROUTER_API_KEY) {
          send({ type: "note", code: "missing_openrouter_key" });
          send({ type: "done" });
          return;
        }

        const aiEvents = result.events.slice(0, AI_EVENT_CAP);
        if (result.events.length > AI_EVENT_CAP) send({ type: "note", code: "ai_cap" });

        for (const event of aiEvents) {
          const evaluations = modelRows.filter((row) => row.eventId === event.id);
          const output = await generatePrediction({
            model: settings.llmModel,
            promptVersion: settings.promptVersion,
            webSearch: settings.webSearchEnabled,
            payload: predictionPayload(event, league.group, settings.region, evaluations),
          });
          await store.recordAiRequest({
            eventId: event.id,
            model: output.model,
            promptVersion: output.promptVersion,
            tokensIn: output.tokensIn,
            tokensOut: output.tokensOut,
            costUsd: output.costUsd,
            latencyMs: output.latencyMs,
            rawResponse: { content: output.raw },
            error: output.validationError,
            source: "test",
          });
          send({
            type: "prediction",
            eventId: event.id,
            home: event.home,
            away: event.away,
            model: output.model,
            promptVersion: output.promptVersion,
            tokensIn: output.tokensIn,
            tokensOut: output.tokensOut,
            costUsd: output.costUsd,
            latencyMs: output.latencyMs,
            parsed: output.parsed,
            raw: output.raw,
            validationError: output.validationError,
          });
        }

        send({ type: "done" });
      } catch {
        send({ type: "error", code: "odds_failed" });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return { stream };
}

function summarizeEvent(event: OddsEvent) {
  const totalPoint = mostCommonPoint(event);
  return {
    eventId: event.id,
    home: event.home,
    away: event.away,
    commenceTime: event.commenceTime,
    bookmakerCount: event.bookmakerCount,
    bestHome: bestPrice(event, "home", null),
    bestDraw: bestPrice(event, "draw", null),
    bestAway: bestPrice(event, "away", null),
    totalPoint,
    bestOver: bestPrice(event, "over", totalPoint),
    bestUnder: bestPrice(event, "under", totalPoint),
  };
}

function bestPrice(event: OddsEvent, selection: string, point: number | null): number | null {
  let best: number | null = null;
  for (const quote of event.quotes) {
    if (quote.selection !== selection) continue;
    if (point != null && quote.point !== point) continue;
    if (best == null || quote.price > best) best = quote.price;
  }
  return best;
}

function mostCommonPoint(event: OddsEvent): number | null {
  const counts = new Map<number, number>();
  for (const quote of event.quotes) {
    if (quote.point == null) continue;
    counts.set(quote.point, (counts.get(quote.point) ?? 0) + 1);
  }
  let winner: number | null = null;
  let winnerCount = 0;
  for (const [point, count] of counts) {
    if (count > winnerCount) {
      winner = point;
      winnerCount = count;
    }
  }
  return winner;
}

function predictionPayload(
  event: OddsEvent,
  group: SportGroup,
  region: string,
  evaluations: ReturnType<typeof evaluateQuotes>,
) {
  return {
    sportGroup: group,
    region,
    event: {
      id: event.id,
      home: event.home,
      away: event.away,
      commenceTime: event.commenceTime,
    },
    quotes: event.quotes,
    model: evaluations,
  };
}

async function redisAllowance(dailyLimit: number): Promise<"ok" | "interval" | "daily" | "skip"> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return "skip";

  try {
    const redis = new Redis({ url, token });
    const interval = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(1, "5 m"),
      prefix: "betinsight:test:interval",
    });
    const daily = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(dailyLimit, "1 d"),
      prefix: "betinsight:test:daily",
    });
    const intervalResult = await interval.limit("admin");
    if (!intervalResult.success) return "interval";
    const dailyResult = await daily.limit("admin");
    if (!dailyResult.success) return "daily";
    return "ok";
  } catch {
    return "skip";
  }
}
