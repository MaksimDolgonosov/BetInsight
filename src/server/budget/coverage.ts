import { budgetSnapshot } from "@/server/budget/budget";
import type { Market } from "@/server/domain/settings";

export const SCORES_REQUEST_COST = 2;
export const CLOSING_CREDIT_CAP = 100;
export const CLOSING_LEAGUE_DAY_CUTOFF = 90;
export const CLOSING_LEAD_MS = 20 * 60 * 1000;

const CLOSING_PRIORITY = [
  "soccer_uefa_champs_league",
  "basketball_nba",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "basketball_euroleague",
];

export type FutureLeagueDay = {
  sportKey: string;
  day: string;
  firstCommence: string;
  oddsPaid: boolean;
  scoresPaid: boolean;
};

export type CreditCoverage = {
  remaining: number;
  reserveCredits: number;
  markets: Market[];
  leagueDays: number;
  closingCreditsUsed: number;
  futureDays: FutureLeagueDay[];
};

export type UsageCreditRow = {
  cost: number;
  remaining: number | null;
  createdAt: Date;
  endpoint: string;
  params: { sportKey?: string; day?: string; purpose?: string };
};

export function buildCreditCoverage(input: {
  today: string;
  month: string;
  monthlyLimit: number;
  reserveCredits: number;
  markets: Market[];
  now: Date;
  usage: UsageCreditRow[];
  events: { sportKey: string; day: string; commenceTime: string }[];
}): CreditCoverage {
  const used = input.usage.reduce((sum, row) => sum + row.cost, 0);
  const latest = [...input.usage]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .find((row) => row.remaining != null);
  const snapshot = budgetSnapshot({
    monthlyLimit: input.monthlyLimit,
    reserveCredits: input.reserveCredits,
    used,
    now: input.now,
    apiRemaining: latest?.remaining ?? null,
  });

  const oddsPaid = new Set<string>();
  const scoresPaid = new Set<string>();
  const leagueDays = new Set<string>();
  let closingCreditsUsed = 0;

  for (const row of input.usage) {
    if (!(row.cost > 0)) continue;
    const sportKey = row.params.sportKey;
    const day = row.params.day;
    const purpose = row.params.purpose ?? "";
    if (purpose === "prestart") closingCreditsUsed += row.cost;
    if (!sportKey || !day || !day.startsWith(input.month)) continue;
    const key = leagueKey(sportKey, day);
    leagueDays.add(key);
    if (row.endpoint.includes("/odds") && purpose === "opening") oddsPaid.add(key);
    if (row.endpoint.includes("/scores")) scoresPaid.add(key);
  }

  const future = new Map<string, FutureLeagueDay>();
  for (const event of input.events) {
    if (!event.day.startsWith(input.month) || event.day < input.today) continue;
    const key = leagueKey(event.sportKey, event.day);
    leagueDays.add(key);
    const current = future.get(key);
    if (!current || event.commenceTime < current.firstCommence) {
      future.set(key, {
        sportKey: event.sportKey,
        day: event.day,
        firstCommence: event.commenceTime,
        oddsPaid: oddsPaid.has(key),
        scoresPaid: scoresPaid.has(key),
      });
    }
  }

  return {
    remaining: snapshot.remaining,
    reserveCredits: input.reserveCredits,
    markets: input.markets,
    leagueDays: leagueDays.size,
    closingCreditsUsed,
    futureDays: [...future.values()],
  };
}

export function marketsForRequest(input: CreditCoverage): Market[] {
  if (!input.markets.includes("spreads")) return input.markets;
  const free = input.remaining - input.reserveCredits;
  if (free >= unpaid(input.futureDays, input.markets.length)) return input.markets;
  return input.markets.filter((market) => market !== "spreads");
}

export function shouldDropTennis(input: CreditCoverage, markets: Market[]): boolean {
  if (!input.futureDays.some((day) => isTennis(day.sportKey))) return false;
  return input.remaining - input.reserveCredits < unpaid(input.futureDays, markets.length);
}

export function closingLeagueDays(input: CreditCoverage, markets: Market[], today: string): FutureLeagueDay[] {
  if (markets.length === 0 || input.leagueDays >= CLOSING_LEAGUE_DAY_CUTOFF) return [];
  const skipTennis = shouldDropTennis(input, markets);
  const days = input.futureDays.filter((day) => !(skipTennis && isTennis(day.sportKey)));
  const mandatory = unpaid(days, markets.length);
  const room = Math.min(
    CLOSING_CREDIT_CAP - input.closingCreditsUsed,
    input.remaining - input.reserveCredits - mandatory,
  );
  if (room < markets.length) return [];

  const chosen: FutureLeagueDay[] = [];
  let left = room;
  for (const day of [...days].sort(compareClosing)) {
    if (left < markets.length) break;
    chosen.push(day);
    left -= markets.length;
  }
  return chosen.filter((day) => day.day === today);
}

export function resolveOddsMarkets(allowed: Market[], planned: Market[] | undefined, live: Market[]): Market[] {
  const base = planned?.length ? planned.filter((market) => allowed.includes(market)) : allowed;
  const resolved = base.filter((market) => live.includes(market));
  return resolved.length > 0 ? resolved : live.filter((market) => allowed.includes(market));
}

function unpaid(days: FutureLeagueDay[], oddsCost: number): number {
  return days.reduce((sum, day) => sum + (day.oddsPaid ? 0 : oddsCost) + (day.scoresPaid ? 0 : SCORES_REQUEST_COST), 0);
}

function compareClosing(left: FutureLeagueDay, right: FutureLeagueDay): number {
  const rank = closingRank(left.sportKey) - closingRank(right.sportKey);
  if (rank !== 0) return rank;
  return left.day.localeCompare(right.day) || left.sportKey.localeCompare(right.sportKey);
}

function closingRank(sportKey: string): number {
  const index = CLOSING_PRIORITY.indexOf(sportKey);
  if (index >= 0) return index;
  if (isTennis(sportKey)) return CLOSING_PRIORITY.length;
  return CLOSING_PRIORITY.length + 1;
}

function isTennis(sportKey: string): boolean {
  return sportKey.startsWith("tennis_");
}

function leagueKey(sportKey: string, day: string): string {
  return `${sportKey}|${day}`;
}
