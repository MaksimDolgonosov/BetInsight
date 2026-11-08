import "server-only";
import { z } from "zod";
import { getAdminStore } from "@/server/admin/store";
import { thresholdsForGroup } from "@/server/domain/odds/evaluate";
import { isSportGroup, LEAGUE_CATALOG, type Market } from "@/server/domain/settings";
import { appBaseUrl, enqueueJob } from "@/server/integrations/qstash/enqueue";
import { ensureDataSchedules } from "@/server/integrations/qstash/schedules";
import { fetchLeagueOdds, fetchSportEvents, fetchSports, fetchSportScores, oddsApiMode } from "@/server/integrations/odds-api/client";
import { mapOddsEvents, mapScores, type OddsEvent } from "@/server/integrations/odds-api/schema";
import { scheduleModelFollowups } from "@/server/jobs/ai";
import { evaluateLeague } from "@/server/jobs/evaluate";
import { JobInputError } from "@/server/jobs/errors";
import { oddsRequestCost, planDay, scoresRequestCost } from "@/server/jobs/plan";
import {
  budgetAllows,
  enabledLeagues,
  findCachedCall,
  hasUnsettledScores,
  listPlanEvents,
  loadLatestOdds,
  rememberCall,
  replaceJobEvaluations,
  saveOdds,
  saveScores,
  saveSports,
  saveUpcomingEvents,
} from "@/server/jobs/persist";
import { runJob, type JobOutcome } from "@/server/jobs/runner";
import { isoWeekKey, mskDate, sixHourBucket } from "@/server/jobs/time";

const SCORE_DAYS_FROM = 3;

const paidSchema = z.object({
  sportKey: z.string().regex(/^[a-z0-9_]{3,80}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  purpose: z.enum(["opening", "closing", "retry"]),
});

export async function runSyncSports(payload: unknown, now: Date): Promise<JobOutcome> {
  return runJob({
    job: "sync-sports",
    idempotencyKey: `sync-sports:${isoWeekKey(mskDate(now))}`,
    payload,
    now,
    work: async () => {
      const result = await fetchSports({ catalogKeys: LEAGUE_CATALOG.map((league) => league.key) });
      if (!result.ok) throw new Error(result.error ?? "odds_failed");
      const present = new Set(result.data.map((sport) => sport.key));
      const missing = LEAGUE_CATALOG.filter((league) => !present.has(league.key)).map((league) => ({
        ...league,
        active: false,
      }));
      await saveSports([...result.data, ...missing]);
      await rememberCall({
        endpoint: result.endpoint,
        sportKey: null,
        day: mskDate(now),
        purpose: "sync-sports",
        cost: chargedCost(result.mocked, result.lastCost, 0),
        remaining: result.remaining,
        used: result.used,
        params: { day: mskDate(now) },
        body: result.raw,
      });
      const schedules = await registerSchedules();
      return { status: "done", detail: { sports: result.data.length + missing.length, schedules } };
    },
  });
}

export async function runSyncEvents(payload: unknown, now: Date): Promise<JobOutcome> {
  return runJob({
    job: "sync-events",
    idempotencyKey: `sync-events:${sixHourBucket(now)}`,
    payload,
    now,
    work: async () => {
      const leagues = await enabledLeagues();
      let count = 0;
      for (const league of leagues) {
        const result = await fetchSportEvents({ sportKey: league.key });
        if (!result.ok) throw new Error(result.error ?? "odds_failed");
        await saveUpcomingEvents(result.data);
        count += result.data.length;
        await rememberCall({
          endpoint: result.endpoint,
          sportKey: league.key,
          day: mskDate(now),
          purpose: "sync-events",
          cost: chargedCost(result.mocked, result.lastCost, 0),
          remaining: result.remaining,
          used: result.used,
          params: { sportKey: league.key, day: mskDate(now), purpose: "sync-events" },
          body: result.raw,
        });
      }
      return { status: "done", detail: { leagues: leagues.length, events: count } };
    },
  });
}

export async function runPlanDay(payload: unknown, now: Date): Promise<JobOutcome> {
  return runJob({
    job: "plan-day",
    idempotencyKey: `plan-day:${mskDate(now)}`,
    payload,
    now,
    work: async () => {
      const leagues = await enabledLeagues();
      const stored = await listPlanEvents();
      const calls = planDay({
        now,
        leagues,
        events: stored.map((event) => ({
          sportKey: event.sportKey,
          commenceTime: event.commenceTime.toISOString(),
          status: event.status,
        })),
      });
      for (const call of calls) {
        const queued = await enqueueJob(
          call.job,
          { sportKey: call.sportKey, day: call.day, purpose: call.purpose },
          {
            notBefore: call.notBefore,
            deduplicationId: `${call.job}-${call.sportKey}-${call.day}-${call.purpose}`,
          },
        );
        if (!queued.ok) throw new Error(queued.reason);
      }
      return { status: "done", detail: { calls: calls.length } };
    },
  });
}

export async function runFetchOdds(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = paidSchema.safeParse(payload);
  if (!parsed.success || parsed.data.purpose !== "opening") throw new JobInputError("invalid_payload");
  const { sportKey, day, purpose } = parsed.data;
  return runJob({
    job: "fetch-odds",
    idempotencyKey: `fetch-odds:${sportKey}:${day}:${purpose}`,
    payload,
    now,
    work: () => fetchOddsWork(sportKey, day, purpose, now),
  });
}

export async function runFetchScores(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = paidSchema.safeParse(payload);
  if (!parsed.success || parsed.data.purpose === "opening") throw new JobInputError("invalid_payload");
  const { sportKey, day, purpose } = parsed.data;
  return runJob({
    job: "fetch-scores",
    idempotencyKey: `fetch-scores:${sportKey}:${day}:${purpose}`,
    payload,
    now,
    work: () => fetchScoresWork(sportKey, day, purpose, now),
  });
}

async function fetchOddsWork(sportKey: string, day: string, purpose: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  const league = (await enabledLeagues()).find((item) => item.key === sportKey);
  if (!league) return { status: "skipped", detail: { reason: "league_disabled" } };
  const endpoint = `GET /v4/sports/${sportKey}/odds`;
  const cached = await findCachedCall({ endpoint, sportKey, day, purpose });
  if (cached) {
    await saveOdds(eventsForMarkets(mapOddsEvents(cached.body).events, settings.markets), now);
    await followWithModel(sportKey, day, now);
    return { status: "skipped", detail: { reason: "duplicate_request" } };
  }

  const expected = oddsRequestCost(settings.markets);
  if (oddsApiMode() !== "mock") {
    const allowed = await budgetAllows({
      cost: expected,
      task: "other",
      now,
      monthlyLimit: settings.monthlyCreditLimit,
      reserveCredits: settings.reserveCredits,
      sportKey,
      endpoint,
    });
    if (!allowed.ok) return { status: "skipped", detail: { reason: allowed.reason } };
  }

  const result = await fetchLeagueOdds({ sportKey, region: settings.region, markets: settings.markets });
  if (!result.ok) throw new Error(result.error ?? "odds_failed");
  const cost = chargedCost(result.mocked, result.lastCost, expected);
  await rememberCall({
    endpoint,
    sportKey,
    day,
    purpose,
    cost,
    remaining: result.remaining,
    used: result.used,
    params: { sportKey, day, purpose, region: settings.region, markets: settings.markets },
    body: result.raw,
  });
  await saveOdds(result.events, now);
  await followWithModel(sportKey, day, now);
  return { status: "done", detail: { events: result.events.length, cost } };
}

const evaluateSchema = z.object({
  sportKey: z.string().regex(/^[a-z0-9_]{3,80}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function runEvaluateModel(payload: unknown, now: Date): Promise<JobOutcome> {
  const parsed = evaluateSchema.safeParse(payload);
  if (!parsed.success) throw new JobInputError("invalid_payload");
  const { sportKey, day } = parsed.data;
  return runJob({
    job: "evaluate-model",
    idempotencyKey: `evaluate-model:${sportKey}:${day}`,
    payload,
    now,
    work: () => evaluateModelWork(sportKey, day, now),
  });
}

async function evaluateModelWork(sportKey: string, day: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  const league = (await enabledLeagues()).find((item) => item.key === sportKey);
  if (!league || !isSportGroup(league.group)) return { status: "skipped", detail: { reason: "league_disabled" } };
  const loaded = await loadLatestOdds(sportKey);
  if (loaded.length === 0) return { status: "skipped", detail: { reason: "no_odds" } };

  const rows = evaluateLeague({
    events: loaded,
    thresholds: thresholdsForGroup(league.group, settings.thresholds),
    aiPick: {
      oddsMin: settings.aiPick.oddsMin,
      oddsMax: settings.aiPick.oddsMax,
      minEv: settings.aiPick.minEv,
      shortlistSize: settings.aiPick.shortlistSize,
    },
  });
  await replaceJobEvaluations(loaded.map((event) => event.id), rows, now);
  await scheduleModelFollowups({ rows, day, now, aiPickEnabled: settings.aiPick.enabled });
  return {
    status: "done",
    detail: {
      events: loaded.length,
      rows: rows.length,
      candidates: rows.filter((row) => row.isCandidate).length,
      nearMisses: rows.filter((row) => row.nearMiss).length,
    },
  };
}

async function followWithModel(sportKey: string, day: string, now: Date) {
  if (appBaseUrl()?.startsWith("https://")) {
    const queued = await enqueueJob(
      "evaluate-model",
      { sportKey, day },
      { deduplicationId: `evaluate-model-${sportKey}-${day}` },
    );
    if (queued.ok || queued.reason !== "scheduler_unconfigured") {
      if (!queued.ok) throw new Error(queued.reason);
      return;
    }
  }
  await runEvaluateModel({ sportKey, day }, now);
}

async function fetchScoresWork(sportKey: string, day: string, purpose: string, now: Date): Promise<JobOutcome> {
  const settings = await getAdminStore().getSettings();
  const league = (await enabledLeagues()).find((item) => item.key === sportKey);
  if (!league) return { status: "skipped", detail: { reason: "league_disabled" } };
  const endpoint = `GET /v4/sports/${sportKey}/scores`;
  const cached = await findCachedCall({ endpoint, sportKey, day, purpose });
  if (cached) {
    const mapped = mapScores(cached.body);
    if (mapped.valid) await saveScores(mapped.events, now);
    return { status: "skipped", detail: { reason: "duplicate_request" } };
  }
  if (!(await hasUnsettledScores(sportKey, now))) {
    return { status: "skipped", detail: { reason: "no_events" } };
  }

  const expected = scoresRequestCost(SCORE_DAYS_FROM);
  if (oddsApiMode() !== "mock") {
    const allowed = await budgetAllows({
      cost: expected,
      task: "scores",
      now,
      monthlyLimit: settings.monthlyCreditLimit,
      reserveCredits: settings.reserveCredits,
      sportKey,
      endpoint,
    });
    if (!allowed.ok) return { status: "skipped", detail: { reason: allowed.reason } };
  }

  const result = await fetchSportScores({ sportKey, daysFrom: SCORE_DAYS_FROM });
  if (!result.ok) throw new Error(result.error ?? "odds_failed");
  const cost = chargedCost(result.mocked, result.lastCost, expected);
  await rememberCall({
    endpoint,
    sportKey,
    day,
    purpose,
    cost,
    remaining: result.remaining,
    used: result.used,
    params: { sportKey, day, purpose, daysFrom: SCORE_DAYS_FROM },
    body: result.raw,
  });
  await saveScores(result.data, now);
  return { status: "done", detail: { events: result.data.length, cost } };
}

function eventsForMarkets(events: OddsEvent[], markets: Market[]): OddsEvent[] {
  return events.map((event) => ({
    ...event,
    quotes: event.quotes.filter((quote) => markets.includes(quote.market as Market)),
  }));
}

function chargedCost(mocked: boolean, lastCost: number | null, expected: number): number {
  if (mocked) return 0;
  if (lastCost != null && lastCost > 0) return lastCost;
  return expected;
}

async function registerSchedules(): Promise<string> {
  try {
    return await ensureDataSchedules();
  } catch {
    return "failed";
  }
}
