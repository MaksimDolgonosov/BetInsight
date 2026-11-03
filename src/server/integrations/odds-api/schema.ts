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
          if (market.key !== "h2h" && market.key !== "totals") continue;
          for (const outcome of market.outcomes) {
            const selection = selectionFor(outcome.name, event.home_team, event.away_team, market.key);
            if (!selection) continue;
            quotes.push({
              bookmakerKey: bookmaker.key,
              bookmaker: bookmaker.title,
              market: market.key,
              selection,
              point: market.key === "totals" ? (outcome.point ?? null) : null,
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

function selectionFor(
  name: string,
  home: string,
  away: string,
  market: Market,
): Selection | null {
  if (market === "h2h") {
    if (name === home) return "home";
    if (name === away) return "away";
    if (name.toLowerCase() === "draw") return "draw";
    return null;
  }
  if (name.toLowerCase() === "over") return "over";
  if (name.toLowerCase() === "under") return "under";
  return null;
}
