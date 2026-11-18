import { CLOSING_LEAD_MS, closingLeagueDays, marketsForRequest, shouldDropTennis, type CreditCoverage } from "@/server/budget/coverage";
import { inSelectionWindow } from "@/server/domain/selection";
import type { Market } from "@/server/domain/settings";
import { mskDate } from "@/server/jobs/time";

const HOUR = 60 * 60 * 1000;
export const SCORES_LAG_MS = 3 * HOUR;
export const SCORE_LOOKBACK_MS = 3 * 24 * HOUR;

export type PlannedCall = {
  job: "fetch-odds" | "fetch-scores" | "fetch-closing-odds";
  sportKey: string;
  day: string;
  purpose: "opening" | "closing" | "retry" | "prestart";
  notBefore: Date;
  markets?: Market[];
};

export type PlanEvent = {
  sportKey: string;
  commenceTime: string;
  status: string;
};

export function planDay(input: {
  now: Date;
  leagues: { key: string }[];
  events: PlanEvent[];
  coverage?: CreditCoverage;
  window?: { minHours: number; maxHours: number };
}): PlannedCall[] {
  const day = mskDate(input.now);
  const window = input.window ?? { minHours: 4, maxHours: 24 };
  const leagueKeys = new Set(input.leagues.map((league) => league.key));
  const markets = input.coverage ? marketsForRequest(input.coverage) : undefined;
  const skipTennis = input.coverage && markets ? shouldDropTennis(input.coverage, markets) : false;
  const closingKeys = new Set(
    input.coverage && markets ? closingLeagueDays(input.coverage, markets, day).map((item) => item.sportKey) : [],
  );
  const calls: PlannedCall[] = [];

  for (const sportKey of leagueKeys) {
    const today = input.events.filter(
      (event) => event.sportKey === sportKey && mskDate(new Date(event.commenceTime)) === day,
    );
    const upcoming = today.filter((event) => new Date(event.commenceTime).getTime() > input.now.getTime());
    const windowed = input.events.filter((event) => eventInWindow(event, sportKey, input.now, window));
    if (!(skipTennis && sportKey.startsWith("tennis_")) && (windowed.length > 0 || upcoming.length > 0)) {
      if (windowed.length > 0) {
        calls.push({
          job: "fetch-odds",
          sportKey,
          day,
          purpose: "opening",
          notBefore: input.now,
          ...(markets ? { markets } : {}),
        });
      }
      if (upcoming.length === 0) continue;
      const first = earliest(upcoming);
      const last = latest(today);
      if (closingKeys.has(sportKey)) {
        calls.push({
          job: "fetch-closing-odds",
          sportKey,
          day,
          purpose: "prestart",
          notBefore: new Date(first.getTime() - CLOSING_LEAD_MS),
          ...(markets ? { markets } : {}),
        });
      }
      calls.push({
        job: "fetch-scores",
        sportKey,
        day,
        purpose: "closing",
        notBefore: new Date(last.getTime() + SCORES_LAG_MS),
      });
    }

    const retry = input.events.some((event) => needsScoreRetry(event, sportKey, input.now));
    if (retry) {
      calls.push({
        job: "fetch-scores",
        sportKey,
        day,
        purpose: "retry",
        notBefore: input.now,
      });
    }
  }

  return calls;
}

export function oddsRequestCost(markets: string[]): number {
  return markets.length;
}

export function scoresRequestCost(daysFrom: number): number {
  return daysFrom >= 1 ? 2 : 1;
}

export function absentScoreIds(input: {
  events: { id: string; commenceTime: string; status: string }[];
  seenIds: string[];
  now: Date;
}): string[] {
  const seen = new Set(input.seenIds);
  const latest = input.now.getTime() - SCORES_LAG_MS;
  const earliest = input.now.getTime() - SCORE_LOOKBACK_MS;
  return input.events.flatMap((event) => {
    if (event.status === "completed" || event.status === "void" || seen.has(event.id)) return [];
    const commence = new Date(event.commenceTime).getTime();
    if (commence > latest || commence < earliest) return [];
    return [event.id];
  });
}

function eventInWindow(
  event: PlanEvent,
  sportKey: string,
  now: Date,
  window: { minHours: number; maxHours: number },
): boolean {
  if (event.sportKey !== sportKey || event.status === "completed" || event.status === "void") return false;
  return inSelectionWindow(new Date(event.commenceTime), now, window);
}

function needsScoreRetry(event: PlanEvent, sportKey: string, now: Date): boolean {
  if (event.sportKey !== sportKey) return false;
  if (event.status === "completed" || event.status === "void") return false;
  const commence = new Date(event.commenceTime).getTime();
  return commence <= now.getTime() - SCORES_LAG_MS && commence >= now.getTime() - SCORE_LOOKBACK_MS;
}

function earliest(events: PlanEvent[]): Date {
  return new Date(Math.min(...events.map((event) => new Date(event.commenceTime).getTime())));
}

function latest(events: PlanEvent[]): Date {
  return new Date(Math.max(...events.map((event) => new Date(event.commenceTime).getTime())));
}
