import { mskDate } from "@/server/jobs/time";

const HOUR = 60 * 60 * 1000;
export const ODDS_LEAD_MS = 4 * HOUR;
export const SCORES_LAG_MS = 3 * HOUR;
export const SCORE_LOOKBACK_MS = 3 * 24 * HOUR;

export type PlannedCall = {
  job: "fetch-odds" | "fetch-scores";
  sportKey: string;
  day: string;
  purpose: "opening" | "closing" | "retry";
  notBefore: Date;
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
}): PlannedCall[] {
  const day = mskDate(input.now);
  const leagueKeys = new Set(input.leagues.map((league) => league.key));
  const calls: PlannedCall[] = [];

  for (const sportKey of leagueKeys) {
    const today = input.events.filter(
      (event) => event.sportKey === sportKey && mskDate(new Date(event.commenceTime)) === day,
    );
    const upcoming = today.filter((event) => new Date(event.commenceTime).getTime() > input.now.getTime());
    if (upcoming.length > 0) {
      const first = earliest(upcoming);
      const last = latest(today);
      calls.push({
        job: "fetch-odds",
        sportKey,
        day,
        purpose: "opening",
        notBefore: new Date(first.getTime() - ODDS_LEAD_MS),
      });
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
