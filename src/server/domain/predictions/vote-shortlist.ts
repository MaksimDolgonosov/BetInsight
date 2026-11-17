import type { Selection } from "@/server/domain/odds/evaluate";
import { outcomeKey, type PickRef } from "@/server/domain/predictions/ai-pick";
import { MARKETS, type Market, type SportGroup } from "@/server/domain/settings";

export type VoteMarketOutcome = {
  market: string;
  selection: string;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
};

export type VoteCandidate = PickRef & {
  consensusProb: number | null;
  bestPrice: number | null;
  bestBookmaker: string | null;
  ev: number | null;
};

const MARKET_SET = new Set<string>(MARKETS);
const SELECTIONS = new Set<Selection>(["home", "draw", "away", "over", "under"]);
const MARKET_ORDER: Record<Market, number> = { h2h: 0, totals: 1, spreads: 2 };
const SELECTION_ORDER: Record<Selection, number> = { home: 0, draw: 1, away: 2, over: 3, under: 4 };

export function voteShortlist(input: {
  sportGroup: SportGroup;
  outcomes: readonly VoteMarketOutcome[];
  limit?: number;
}): VoteCandidate[] {
  const priced = input.outcomes
    .filter(isPricedMarket)
    .sort(byProbability)
    .slice(0, input.limit ?? 3)
    .map(toCandidate);
  if (priced.length >= 2) return priced;

  const fallback = headToHead(input.sportGroup).map((pick) => withQuote(pick, input.outcomes));
  const covered = fallback.filter((pick) => hasPrice(pick));
  return covered.length >= 2 ? covered : fallback;
}

export function shortlistPricesReady(candidates: readonly VoteCandidate[]): boolean {
  return candidates.length >= 2 && candidates.every(hasPrice);
}

function headToHead(sportGroup: SportGroup): PickRef[] {
  const selections: Selection[] = sportGroup === "soccer" ? ["home", "draw", "away"] : ["home", "away"];
  return selections.map((selection) => ({ market: "h2h", selection, point: null }));
}

function withQuote(pick: PickRef, outcomes: readonly VoteMarketOutcome[]): VoteCandidate {
  const quote = outcomes
    .filter(isPricedMarket)
    .filter((row) => outcomeKey(toPick(row)) === outcomeKey(pick))
    .sort((left, right) => right.bestPrice - left.bestPrice)[0];
  if (!quote) return { ...pick, consensusProb: null, bestPrice: null, bestBookmaker: null, ev: null };
  return toCandidate(quote);
}

function isPricedMarket(row: VoteMarketOutcome): boolean {
  return MARKET_SET.has(row.market) && SELECTIONS.has(row.selection as Selection) && row.bestPrice > 1;
}

function toPick(row: VoteMarketOutcome): PickRef {
  return { market: row.market as Market, selection: row.selection as Selection, point: row.point };
}

function toCandidate(row: VoteMarketOutcome): VoteCandidate {
  return { ...toPick(row), consensusProb: row.consensusProb, bestPrice: row.bestPrice, bestBookmaker: row.bestBookmaker, ev: row.ev };
}

function hasPrice(candidate: VoteCandidate): boolean {
  return candidate.bestPrice != null && candidate.bestPrice > 1;
}

function byProbability(left: VoteMarketOutcome, right: VoteMarketOutcome): number {
  if (right.consensusProb !== left.consensusProb) return right.consensusProb - left.consensusProb;
  const market = MARKET_ORDER[left.market as Market] - MARKET_ORDER[right.market as Market];
  if (market !== 0) return market;
  const selection = SELECTION_ORDER[left.selection as Selection] - SELECTION_ORDER[right.selection as Selection];
  if (selection !== 0) return selection;
  return (left.point ?? Number.NEGATIVE_INFINITY) - (right.point ?? Number.NEGATIVE_INFINITY);
}
