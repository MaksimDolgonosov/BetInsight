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
  return `${quote.market}:${quote.point ?? ""}`;
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
    const lineAllowed =
      sample.market !== "totals" ||
      (sample.point != null &&
        sample.point >= thresholds.totalsPointMin &&
        sample.point <= thresholds.totalsPointMax);

    for (const [selection, rows] of fairBySelection) {
      const best = bestBySelection.get(selection);
      if (!best) continue;
      const consensusProb = consensusProbability(rows);
      const ev = expectedValue(consensusProb, best.price);
      const candidate =
        lineAllowed &&
        ev > thresholds.evThreshold &&
        best.price >= thresholds.oddsMin &&
        best.price <= thresholds.oddsMax &&
        byBookmaker.size >= thresholds.minBookmakers;

      evaluations.push({
        market: sample.market,
        selection,
        point: sample.point,
        consensusProb,
        bestPrice: best.price,
        bestBookmaker: best.bookmaker,
        ev,
        bookmakerCount: byBookmaker.size,
        candidate,
      });
    }
  }

  return evaluations.sort((left, right) => right.ev - left.ev);
}

export function thresholdsForGroup(
  group: SportGroup,
  thresholds: Record<SportGroup, SportThresholds>,
): SportThresholds {
  return thresholds[group];
}
