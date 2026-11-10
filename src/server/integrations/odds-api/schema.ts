import { z } from "zod";
import type { Market } from "@/server/domain/settings";
import type { NormalizedQuote, Selection } from "@/server/domain/odds/evaluate";

const outcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});

const bookmakerSchema = z.object({
  key: z.string(),
  title: z.string(),
  markets: z.array(
    z.object({
      key: z.string(),
      outcomes: z.array(outcomeSchema),
    }),
  ),
});

const eventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(bookmakerSchema).default([]),
});

export const oddsResponseSchema = z.array(eventSchema);

export type OddsEvent = {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: string;
  bookmakerCount: number;
  quotes: NormalizedQuote[];
};

export function mapOddsEvents(payload: unknown): { events: OddsEvent[]; valid: boolean } {
  const parsed = oddsResponseSchema.safeParse(payload);
  if (!parsed.success) return { events: [], valid: false };

  const events = parsed.data
    .map((event) => {
      const quotes: NormalizedQuote[] = [];
      for (const bookmaker of event.bookmakers) {
        for (const market of bookmaker.markets) {
          if (market.key !== "h2h" && market.key !== "totals" && market.key !== "spreads") continue;
          for (const outcome of market.outcomes) {
            const selection = selectionFor(outcome.name, event.home_team, event.away_team, market.key);
            if (!selection) continue;
            const point = market.key === "h2h" ? null : (outcome.point ?? null);
            if (market.key === "spreads" && point == null) continue;
            quotes.push({
              bookmakerKey: bookmaker.key,
              bookmaker: bookmaker.title,
              market: market.key,
              selection,
              point,
              price: outcome.price,
            });
          }
        }
      }

      return {
        id: event.id,
        sportKey: event.sport_key,
        home: event.home_team,
        away: event.away_team,
        commenceTime: event.commence_time,
        bookmakerCount: event.bookmakers.length,
        quotes,
      };
    })
    .sort((left, right) => left.commenceTime.localeCompare(right.commenceTime));

  return { events, valid: true };
}

const upcomingEventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
});

export type UpcomingEvent = {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commenceTime: string;
};

export function mapUpcomingEvents(payload: unknown): { events: UpcomingEvent[]; valid: boolean } {
  const parsed = z.array(upcomingEventSchema).safeParse(payload);
  if (!parsed.success) return { events: [], valid: false };
  return {
    valid: true,
    events: parsed.data.map((event) => ({
      id: event.id,
      sportKey: event.sport_key,
      home: event.home_team,
      away: event.away_team,
      commenceTime: event.commence_time,
    })),
  };
}

const scoreSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  completed: z.boolean(),
  home_team: z.string(),
  away_team: z.string(),
  scores: z.array(z.object({ name: z.string(), score: z.string() })).nullable().optional(),
});

export type ScoreEvent = UpcomingEvent & {
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
};

export function mapScores(payload: unknown): { events: ScoreEvent[]; valid: boolean } {
  const parsed = z.array(scoreSchema).safeParse(payload);
  if (!parsed.success) return { events: [], valid: false };
  return {
    valid: true,
    events: parsed.data.map((event) => ({
      id: event.id,
      sportKey: event.sport_key,
      home: event.home_team,
      away: event.away_team,
      commenceTime: event.commence_time,
      completed: event.completed,
      homeScore: scoreValue(event.scores, event.home_team),
      awayScore: scoreValue(event.scores, event.away_team),
    })),
  };
}

function scoreValue(scores: { name: string; score: string }[] | null | undefined, team: string): number | null {
  const raw = scores?.find((score) => score.name === team)?.score;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

const sportSchema = z.object({
  key: z.string(),
  group: z.string(),
  title: z.string(),
  active: z.boolean(),
  has_outrights: z.boolean().optional(),
});

export type TrackedSport = {
  key: string;
  group: "soccer" | "basketball" | "nba" | "tennis";
  title: string;
  active: boolean;
};

export function mapTrackedSports(payload: unknown, catalogKeys: readonly string[]): { sports: TrackedSport[]; valid: boolean } {
  const parsed = z.array(sportSchema).safeParse(payload);
  if (!parsed.success) return { sports: [], valid: false };
  const catalog = new Set(catalogKeys);
  const sports = parsed.data.flatMap((row): TrackedSport[] => {
    const group = groupForKey(row.key);
    if (!group) return [];
    const tennis = group === "tennis" && row.active && row.has_outrights !== true && row.group === "Tennis";
    if (!catalog.has(row.key) && !tennis) return [];
    if (group === "tennis" && !/^tennis_[a-z0-9_]{3,70}$/.test(row.key)) return [];
    return [{ key: row.key, group, title: row.title.trim(), active: row.active }];
  });
  return { sports, valid: true };
}

function groupForKey(key: string): TrackedSport["group"] | null {
  if (key === "basketball_nba") return "nba";
  if (key.startsWith("basketball_")) return "basketball";
  if (key.startsWith("soccer_")) return "soccer";
  if (key.startsWith("tennis_")) return "tennis";
  return null;
}

function selectionFor(
  name: string,
  home: string,
  away: string,
  market: Market,
): Selection | null {
  if (market === "h2h" || market === "spreads") {
    if (name === home) return "home";
    if (name === away) return "away";
    if (market === "h2h" && name.toLowerCase() === "draw") return "draw";
    return null;
  }
  if (name.toLowerCase() === "over") return "over";
  if (name.toLowerCase() === "under") return "under";
  return null;
}
