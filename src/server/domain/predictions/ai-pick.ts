import type { OutcomeEvaluation, Selection } from "@/server/domain/odds/evaluate";
import type { Market } from "@/server/domain/settings";

export type ConsensusMode = "two_thirds" | "unanimous";
export type Confidence = "low" | "medium" | "high";

export type PickRef = {
  market: Market;
  selection: Selection;
  point: number | null;
};

export type AiPickRow = OutcomeEvaluation & { eventId: string };

export type ModelVoteInput = {
  model: string;
  pick: PickRef;
  probabilities: (PickRef & { p: number })[];
  confidence: Confidence;
  reasoning: { ru: string; en: string };
};

export type ConsensusDecision = {
  status: "consensus" | "no_consensus";
  pick: PickRef | null;
  votesFor: number;
  votesTotal: number;
  pAiMean: number | null;
  pAiMin: number | null;
  confidence: "medium" | "high" | null;
  reasoning: { ru: string; en: string } | null;
  reasoningModel: string | null;
  bestPrice: number | null;
  matchesMarketFavorite: boolean | null;
};

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function outcomeKey(pick: PickRef): string {
  return `${pick.market}:${pick.selection}:${pick.point ?? ""}`;
}

export function selectAiPickShortlist(
  rows: AiPickRow[],
  options: {
    oddsMin: number;
    oddsMax: number;
    minEv: number;
    minBookmakers: number;
    outcomesPerEvent: number;
    eventLimit: number;
  },
): AiPickRow[] {
  const byEvent = new Map<string, AiPickRow[]>();
  for (const row of rows) {
    if (row.bestPrice < options.oddsMin || row.bestPrice > options.oddsMax) continue;
    if (row.ev < options.minEv) continue;
    if (row.bookmakerCount < options.minBookmakers) continue;
    const bucket = byEvent.get(row.eventId) ?? [];
    bucket.push(row);
    byEvent.set(row.eventId, bucket);
  }

  const events: { outcomes: AiPickRow[]; rankEv: number; books: number }[] = [];
  for (const outcomes of byEvent.values()) {
    const ranked = [...outcomes].sort(
      (left, right) => right.consensusProb - left.consensusProb || right.ev - left.ev,
    );
    const picked = ranked.slice(0, options.outcomesPerEvent);
    if (picked.length < 2) continue;
    events.push({
      outcomes: picked,
      rankEv: Math.max(...picked.map((row) => row.ev)),
      books: Math.max(...picked.map((row) => row.bookmakerCount)),
    });
  }

  events.sort((left, right) => right.rankEv - left.rankEv || right.books - left.books);
  return events.slice(0, options.eventLimit).flatMap((event) => event.outcomes);
}

export function decideConsensus(input: {
  votes: ModelVoteInput[];
  modelCount: number;
  mode: ConsensusMode;
  prices: { key: string; price: number }[];
  tolerance: number;
  marketFavoriteKey: string | null;
}): ConsensusDecision {
  const empty: ConsensusDecision = {
    status: "no_consensus",
    pick: null,
    votesFor: 0,
    votesTotal: input.votes.length,
    pAiMean: null,
    pAiMin: null,
    confidence: null,
    reasoning: null,
    reasoningModel: null,
    bestPrice: null,
    matchesMarketFavorite: null,
  };
  if (input.votes.length === 0 || input.modelCount < 1) return empty;

  const groups = new Map<string, ModelVoteInput[]>();
  for (const vote of input.votes) {
    const key = outcomeKey(vote.pick);
    const bucket = groups.get(key) ?? [];
    bucket.push(vote);
    groups.set(key, bucket);
  }

  const required = input.mode === "unanimous" ? input.modelCount : Math.ceil((input.modelCount * 2) / 3);
  const ranked = [...groups.entries()].sort((left, right) => right[1].length - left[1].length);
  const leading = ranked[0];
  if (!leading || leading[1].length < required) {
    return { ...empty, votesFor: leading?.[1].length ?? 0 };
  }

  const [key, agreeing] = leading;
  const price = input.prices.find((item) => item.key === key)?.price;
  if (price == null || price <= 1) return { ...empty, votesFor: agreeing.length };

  const probabilities = input.votes.map((vote) => probabilityFor(vote, key));
  if (probabilities.some((value) => value == null || value < 0.4)) {
    return { ...empty, votesFor: agreeing.length };
  }
  const known = probabilities.filter((value): value is number => value != null);
  const pAiMean = known.reduce((sum, value) => sum + value, 0) / known.length;
  const pAiMin = Math.min(...known);
  if (pAiMean < 1 / price - input.tolerance) {
    return { ...empty, votesFor: agreeing.length, pAiMean, pAiMin, bestPrice: price };
  }

  const speaker = [...agreeing].sort(
    (left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence],
  )[0]!;
  const average =
    agreeing.reduce((sum, vote) => sum + CONFIDENCE_RANK[vote.confidence], 0) / agreeing.length;
  const confidence = agreeing.length === input.modelCount && average >= CONFIDENCE_RANK.medium ? "high" : "medium";

  return {
    status: "consensus",
    pick: speaker.pick,
    votesFor: agreeing.length,
    votesTotal: input.votes.length,
    pAiMean,
    pAiMin,
    confidence,
    reasoning: speaker.reasoning,
    reasoningModel: speaker.model,
    bestPrice: price,
    matchesMarketFavorite: input.marketFavoriteKey != null ? key === input.marketFavoriteKey : null,
  };
}

export function marketFavoriteKey(rows: Pick<OutcomeEvaluation, "market" | "selection" | "point" | "consensusProb">[]): string | null {
  const favorite = [...rows].sort((left, right) => right.consensusProb - left.consensusProb)[0];
  if (!favorite) return null;
  return outcomeKey(favorite);
}

function probabilityFor(vote: ModelVoteInput, key: string): number | null {
  const match = vote.probabilities.find((item) => outcomeKey(item) === key);
  return match?.p ?? null;
}
