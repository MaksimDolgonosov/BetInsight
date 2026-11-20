import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { oddsSnapshots } from "@/server/db/data-tables";
import { averageBookPrice, latestBefore } from "@/server/domain/odds/lines";
import { samePoint } from "@/server/domain/predictions/publish";

export type AverageKey = {
  eventId: string;
  market: string;
  selection: string;
  point: number | null;
  at: Date;
};

type SnapshotQuote = {
  eventId: string;
  fetchedAt: Date;
  isClosing: boolean;
  bookmaker: string;
  market: string;
  outcome: string;
  point: number | null;
  price: number;
};

export function averageKey(input: AverageKey) {
  return `${input.eventId}|${input.market}|${input.selection}|${input.point ?? ""}|${input.at.toISOString()}`;
}

export function averageFromSnapshots(rows: SnapshotQuote[], input: AverageKey): number | null {
  const own = rows.filter(
    (row) =>
      !row.isClosing &&
      row.eventId === input.eventId &&
      row.market === input.market &&
      row.outcome === input.selection &&
      samePoint(row.point, input.point),
  );
  const batch = latestBefore(own, input.at);
  return averageBookPrice(batch.map((row) => ({ bookmaker: row.bookmaker, selection: row.outcome, price: row.price })));
}

export async function openingAverages(keys: AverageKey[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (keys.length === 0 || !process.env.DATABASE_URL) return result;
  const eventIds = [...new Set(keys.map((key) => key.eventId))];
  const rows = await getDb()
    .select({
      eventId: oddsSnapshots.eventId,
      fetchedAt: oddsSnapshots.fetchedAt,
      isClosing: oddsSnapshots.isClosing,
      bookmaker: oddsSnapshots.bookmaker,
      market: oddsSnapshots.market,
      outcome: oddsSnapshots.outcome,
      point: oddsSnapshots.point,
      price: oddsSnapshots.price,
    })
    .from(oddsSnapshots)
    .where(and(eq(oddsSnapshots.isClosing, false), inArray(oddsSnapshots.eventId, eventIds)));
  for (const key of keys) result.set(averageKey(key), averageFromSnapshots(rows, key));
  return result;
}
