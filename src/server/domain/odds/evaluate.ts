import type { Market, SportGroup, SportThresholds } from "@/server/domain/settings";

export type Selection = "home" | "draw" | "away" | "over" | "under";

export type NormalizedQuote = {
  bookmakerKey: string;
  bookmaker: string;
  market: Market;
  selection: Selection;
  point: number | null;
  price: number;
};

export type OutcomeEvaluation = {
  market: Market;
  selection: Selection;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
  bookmakerCount: number;
  candidate: boolean;
  nearMiss: boolean;
};

export function removeMargin(prices: number[]): number[] {
  const implied = prices.map((price) => 1 / price);
  const total = implied.reduce((sum, value) => sum + value, 0);
  return implied.map((value) => value / total);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function consensusProbability(
  rows: { bookmakerKey: string; bookmaker: string; probability: number }[],
  pinnacleWeight = 2,
): number {
  const samples: number[] = [];
  for (const row of rows) {
    const name = `${row.bookmakerKey} ${row.bookmaker}`.toLowerCase();
    const weight = name.includes("pinnacle") ? pinnacleWeight : 1;
    for (let index = 0; index < weight; index += 1) {
      samples.push(row.probability);
    }
  }
  return median(samples);
}

export function expectedValue(consensusProb: number, bestPrice: number): number {
  return consensusProb * bestPrice - 1;
}

function groupKey(quote: NormalizedQuote): string {
  if (quote.market === "spreads") {
    const homePoint = spreadHomePoint(quote);
    return homePoint == null ? `spreads:invalid:${quote.bookmakerKey}:${quote.selection}:${quote.point ?? ""}` : `spreads:${homePoint}`;
  }
  return `${quote.market}:${quote.point ?? ""}`;
}

function spreadHomePoint(quote: Pick<NormalizedQuote, "selection" | "point">): number | null {
  if (quote.point == null || !Number.isFinite(quote.point)) return null;
  if (quote.selection === "home") return quote.point;
  if (quote.selection === "away") return -quote.point;
  return null;
}

export function evaluateQuotes(
  quotes: NormalizedQuote[],
  thresholds: SportThresholds,
): OutcomeEvaluation[] {
  const groups = new Map<string, NormalizedQuote[]>();
  for (const quote of quotes) {
    if (!Number.isFinite(quote.price) || quote.price <= 1) continue;
    const key = groupKey(quote);
    const bucket = groups.get(key) ?? [];
    bucket.push(quote);
    groups.set(key, bucket);
  }

  const evaluations: OutcomeEvaluation[] = [];

  for (const bucket of groups.values()) {
    const byBookmaker = new Map<string, Map<Selection, NormalizedQuote>>();
    for (const quote of bucket) {
      const selections = byBookmaker.get(quote.bookmakerKey) ?? new Map();
      const current = selections.get(quote.selection);
      if (!current || quote.price > current.price) {
        selections.set(quote.selection, quote);
      }
      byBookmaker.set(quote.bookmakerKey, selections);
    }

    if (bucket[0]?.market === "spreads") {
      for (const [bookmaker, selections] of byBookmaker) {
        const home = selections.get("home");
        const away = selections.get("away");
        const paired =
          home?.point != null &&
          away?.point != null &&
          Math.abs(home.point + away.point) < 1e-6;
        if (!paired) byBookmaker.delete(bookmaker);
      }
    }

    const fairBySelection = new Map<
      Selection,
      { bookmakerKey: string; bookmaker: string; probability: number }[]
    >();
    const bestBySelection = new Map<Selection, NormalizedQuote>();

    for (const selections of byBookmaker.values()) {
      const ordered = [...selections.values()];
      const fair = removeMargin(ordered.map((quote) => quote.price));
      ordered.forEach((quote, index) => {
        const rows = fairBySelection.get(quote.selection) ?? [];
        rows.push({
          bookmakerKey: quote.bookmakerKey,
          bookmaker: quote.bookmaker,
          probability: fair[index]!,
        });
        fairBySelection.set(quote.selection, rows);
        const best = bestBySelection.get(quote.selection);
        if (!best || quote.price > best.price) {
          bestBySelection.set(quote.selection, quote);
        }
      });
    }

    const sample = bucket[0]!;
    const homePoint = sample.market === "spreads" ? spreadHomePoint([...byBookmaker.values()][0]?.get("home") ?? sample) : null;
    const lineAllowed = lineInsideRange(sample.market, sample.point, homePoint, thresholds);

    for (const [selection, rows] of fairBySelection) {
      const best = bestBySelection.get(selection);
      if (!best) continue;
      const consensusProb = consensusProbability(rows);
      const ev = expectedValue(consensusProb, best.price);
      const priced =
        lineAllowed &&
        best.price >= thresholds.oddsMin &&
        best.price <= thresholds.oddsMax &&
        byBookmaker.size >= thresholds.minBookmakers;
      const candidate = priced && ev > thresholds.evThreshold;
      const nearMiss = priced && ev >= 0 && ev <= thresholds.evThreshold && !candidate;

      evaluations.push({
        market: sample.market,
        selection,
        point: best.point,
        consensusProb,
        bestPrice: best.price,
        bestBookmaker: best.bookmaker,
        ev,
        bookmakerCount: byBookmaker.size,
        candidate,
        nearMiss,
      });
    }
  }

  return evaluations.sort((left, right) => right.ev - left.ev);
}

function lineInsideRange(
  market: Market,
  point: number | null,
  homePoint: number | null,
  thresholds: SportThresholds,
): boolean {
  if (market === "totals") {
    return point != null && point >= thresholds.totalsPointMin && point <= thresholds.totalsPointMax;
  }
  if (market !== "spreads" || homePoint == null) return market !== "spreads";
  if (homePoint < thresholds.spreadsPointMin || homePoint > thresholds.spreadsPointMax) return false;
  return !thresholds.spreadsExcludedAbs.some((abs) => Math.abs(Math.abs(homePoint) - abs) < 1e-6);
}

export function thresholdsForGroup(
  group: SportGroup,
  thresholds: Record<SportGroup, SportThresholds>,
): SportThresholds {
  return thresholds[group];
}
