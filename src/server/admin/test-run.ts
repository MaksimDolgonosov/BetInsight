import "server-only";
import { budgetSnapshot, canSpend, startOfUtcDay, startOfUtcMonth } from "@/server/budget/budget";
import { getAdminStore } from "@/server/admin/store";
import type { TestStreamEvent, TestTrack } from "@/server/admin/test-events";
import { evaluateQuotes } from "@/server/domain/odds/evaluate";
import { decideConsensus, marketFavoriteKey, outcomeKey, selectAiPickShortlist, type ModelVoteInput } from "@/server/domain/predictions/ai-pick";
import type { Market, SportGroup } from "@/server/domain/settings";
import { fetchLeagueOdds, oddsApiMode } from "@/server/integrations/odds-api/client";
import { listActiveTennisLeagues } from "@/server/integrations/odds-api/tennis";
import type { OddsEvent } from "@/server/integrations/odds-api/schema";
import { generateResearch } from "@/server/integrations/openrouter/research";
import { generateVote } from "@/server/integrations/openrouter/vote";
import { getRedis } from "@/server/integrations/redis/client";
import { Ratelimit } from "@upstash/ratelimit";

const AI_PICK_EVENT_CAP = 1;

export async function startTestRun(input: {
  sportKey: string;
  markets: Market[];
  tracks: TestTrack[];
  actor: string;
}): Promise<{ stream: ReadableStream<Uint8Array> } | { error: string; status: number }> {
  const store = getAdminStore();
  const settings = await store.getSettings();
  const league = await resolveLeague(settings.leagues, input.sportKey);
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
    apiRemaining: await store.latestRemaining(),
    now,
  });
  const budget = canSpend(snapshot, estimatedCost, "other");
  if (!budget.ok) return { error: budget.reason, status: 409 };
  if (!mocked && !process.env.ODDS_API_KEY) return { error: "missing_odds_key", status: 400 };
  if (process.env.VERCEL_ENV === "production" && usesFreeModel(settings, input.tracks)) {
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
        const evaluated = result.events.flatMap((event) =>
          evaluateQuotes(event.quotes, thresholds).map((row) => ({
            ...row,
            eventId: event.id,
            home: event.home,
            away: event.away,
            commenceTime: event.commenceTime,
          })),
        );
        const shortlist = selectAiPickShortlist(evaluated, {
          oddsMin: settings.aiPick.oddsMin,
          oddsMax: settings.aiPick.oddsMax,
          minEv: settings.aiPick.minEv,
          minBookmakers: thresholds.minBookmakers,
          outcomesPerEvent: 3,
          eventLimit: settings.aiPick.shortlistSize,
        });
        const shortlisted = new Set(shortlist.map((row) => `${row.eventId}|${outcomeKey(row)}`));
        const modelRows = evaluated.map((row) => ({
          ...row,
          aiPickShortlisted: shortlisted.has(`${row.eventId}|${outcomeKey(row)}`),
        }));
        send({ type: "model", rows: modelRows });
        await store.recordModelEvaluations(
          modelRows.map((row) => ({
            eventId: row.eventId,
            home: row.home,
            away: row.away,
            market: row.market,
            outcome: row.selection,
            point: row.point,
            consensusProb: row.consensusProb,
            bestPrice: row.bestPrice,
            bestBookmaker: row.bestBookmaker,
            ev: row.ev,
            isCandidate: row.candidate,
            nearMiss: row.nearMiss,
            aiPickShortlisted: row.aiPickShortlisted,
            source: "test" as const,
          })),
        );

        if (!process.env.OPENROUTER_API_KEY) {
          send({ type: "note", code: "missing_openrouter_key" });
          send({ type: "done" });
          return;
        }

        let searchesLeft = settings.webSearchDailyLimit - (await store.webSearchCountSince(startOfUtcDay(now)));
        let searchNoteSent = false;
        const allowSearch = () => {
          if (!settings.webSearchEnabled) return false;
          if (searchesLeft <= 0) {
            if (!searchNoteSent) {
              send({ type: "note", code: "web_search_limited" });
              searchNoteSent = true;
            }
            return false;
          }
          searchesLeft -= 1;
          return true;
        };

        if (input.tracks.includes("ai_pick")) {
          if (!settings.aiPick.enabled) {
            send({ type: "note", code: "ai_pick_disabled" });
          } else {
            const spent = await store.aiSpendSince(startOfUtcMonth(now), ["research", "vote"]);
            if (spent >= settings.aiPick.monthlyBudgetUsd) {
              send({ type: "note", code: "ai_pick_budget" });
            } else {
              const eventIds: string[] = [];
              for (const row of shortlist) {
                if (!eventIds.includes(row.eventId)) eventIds.push(row.eventId);
              }
              if (eventIds.length === 0) send({ type: "note", code: "no_shortlist" });
              if (eventIds.length > AI_PICK_EVENT_CAP) send({ type: "note", code: "ai_pick_cap" });

              for (const eventId of eventIds.slice(0, AI_PICK_EVENT_CAP)) {
                const event = result.events.find((item) => item.id === eventId);
                if (!event) continue;
                const outcomes = shortlist.filter((row) => row.eventId === eventId);
                const researchModel = settings.aiPick.researchModel || settings.aiPick.models[0];
                const researchSearch = allowSearch();
                const research = await generateResearch({
                  model: researchModel,
                  webSearch: researchSearch,
                  payload: {
                    sportGroup: league.group,
                    event: { id: event.id, home: event.home, away: event.away, commenceTime: event.commenceTime },
                    shortlist: outcomes,
                  },
                });
                await store.recordAiRequest({
                  eventId: event.id,
                  model: research.model,
                  promptVersion: research.promptVersion,
                  tokensIn: research.tokensIn,
                  tokensOut: research.tokensOut,
                  costUsd: research.costUsd,
                  latencyMs: research.latencyMs,
                  rawResponse: { content: research.text },
                  error: research.error,
                  webSearch: research.webSearch,
                  sources: research.sources,
                  purpose: "research",
                  source: "test",
                });
                send({
                  type: "research",
                  eventId: event.id,
                  home: event.home,
                  away: event.away,
                  model: research.model,
                  promptVersion: research.promptVersion,
                  tokensIn: research.tokensIn,
                  tokensOut: research.tokensOut,
                  costUsd: research.costUsd,
                  latencyMs: research.latencyMs,
                  text: research.text,
                  sources: research.sources,
                  error: research.error,
                  webSearch: research.webSearch,
                });

                const votes: ModelVoteInput[] = [];
                const voteIds: string[] = [];
                for (const model of settings.aiPick.models) {
                  const output = await generateVote({
                    model,
                    webSearch: false,
                    allowed: outcomes,
                    payload: {
                      sportGroup: league.group,
                      event: { id: event.id, home: event.home, away: event.away, commenceTime: event.commenceTime },
                      shortlist: outcomes,
                      research: research.text || null,
                    },
                  });
                  const requestId = await store.recordAiRequest({
                    eventId: event.id,
                    model: output.model,
                    promptVersion: output.promptVersion,
                    tokensIn: output.tokensIn,
                    tokensOut: output.tokensOut,
                    costUsd: output.costUsd,
                    latencyMs: output.latencyMs,
                    rawResponse: { content: output.raw },
                    error: output.validationError,
                    webSearch: false,
                    sources: output.sources,
                    purpose: "vote",
                    source: "test",
                  });
                  if (output.parsed) {
                    const voteId = await store.recordVote({
                      eventId: event.id,
                      aiRequestId: requestId,
                      model: output.model,
                      market: output.parsed.pick.market,
                      selection: output.parsed.pick.selection,
                      point: output.parsed.pick.point,
                      probabilities: output.parsed.probabilities,
                      confidence: output.parsed.confidence,
                      reasoningRu: output.parsed.reasoning.ru,
                      reasoningEn: output.parsed.reasoning.en,
                      source: "test",
                    });
                    voteIds.push(voteId);
                    votes.push({
                      model: output.model,
                      pick: output.parsed.pick,
                      probabilities: output.parsed.probabilities,
                      confidence: output.parsed.confidence,
                      reasoning: output.parsed.reasoning,
                    });
                  }
                  send({
                    type: "vote",
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

                const favorite = marketFavoriteKey(modelRows.filter((row) => row.eventId === event.id));
                const decision = decideConsensus({
                  votes,
                  modelCount: settings.aiPick.models.length,
                  mode: settings.aiPick.consensusMode,
                  prices: outcomes.map((row) => ({ key: outcomeKey(row), price: row.bestPrice })),
                  tolerance: settings.aiPick.probabilityTolerance,
                  marketFavoriteKey: favorite,
                });
                await store.recordConsensus({
                  eventId: event.id,
                  home: event.home,
                  away: event.away,
                  models: [...settings.aiPick.models],
                  voteIds,
                  votesFor: decision.votesFor,
                  votesTotal: decision.votesTotal,
                  pAiMean: decision.pAiMean,
                  pAiMin: decision.pAiMin,
                  status: decision.status,
                  market: decision.pick?.market ?? null,
                  selection: decision.pick?.selection ?? null,
                  point: decision.pick?.point ?? null,
                  bestPrice: decision.bestPrice,
                  confidence: decision.confidence,
                  reasoningRu: decision.reasoning?.ru ?? null,
                  reasoningEn: decision.reasoning?.en ?? null,
                  matchesMarketFavorite: decision.matchesMarketFavorite,
                  source: "test",
                });
                send({
                  type: "consensus",
                  eventId: event.id,
                  home: event.home,
                  away: event.away,
                  ...decision,
                });
              }
            }
          }
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

async function resolveLeague(
  leagues: { key: string; group: SportGroup; title: string; enabled: boolean }[],
  sportKey: string,
) {
  const saved = leagues.find((item) => item.key === sportKey && item.enabled);
  if (saved) return saved;
  const tennis = await listActiveTennisLeagues();
  return tennis.find((item) => item.key === sportKey) ?? null;
}

function usesFreeModel(
  settings: { llmModel: string; aiPick: { models: string[]; researchModel: string } },
  tracks: TestTrack[],
) {
  const models = [
    ...(tracks.includes("value") ? [settings.llmModel] : []),
    ...(tracks.includes("ai_pick") ? [...settings.aiPick.models, settings.aiPick.researchModel] : []),
  ];
  return models.some((model) => model.endsWith(":free"));
}

async function redisAllowance(dailyLimit: number): Promise<"ok" | "interval" | "daily" | "skip"> {
  const redis = getRedis();
  if (!redis) return "skip";

  try {
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
