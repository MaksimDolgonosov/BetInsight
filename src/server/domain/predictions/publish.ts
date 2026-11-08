import { createHash } from "node:crypto";
import type { ConsensusDecision } from "@/server/domain/predictions/ai-pick";

export type PredictionTrack = "value" | "ai_pick";

export type CandidateQuote = {
  market: string;
  outcome: string;
  point: number | null;
  consensusProb: number;
  bestPrice: number;
  bestBookmaker: string;
  ev: number;
};

export type SavedPick = {
  market: string;
  selection: string;
  point: number | null;
  price: number;
  bookmaker: string;
  modelProb: number;
  aiProb: number;
  ev: number;
  confidence: string;
  reasoningRu: string;
  reasoningEn: string;
};

export function samePoint(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return left == null && right == null;
  return left === right;
}

export function predictionHash(input: {
  eventId: string;
  home: string;
  away: string;
  commenceTime: string;
  track: PredictionTrack;
  market: string;
  selection: string;
  point: number | null;
  price: number;
  bookmaker: string;
  publishedAt: string;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function decideValuePublication(input: {
  now: Date;
  commenceTime: Date;
  candidates: CandidateQuote[];
  parsed: {
    pick: { market: string; selection: string; point: number | null };
    ai_probability: number;
    confidence: string;
    reasoning: { ru: string; en: string };
    skip: boolean;
  } | null;
}): { action: "save"; pick: SavedPick } | { action: "skip"; reason: "too_late" | "ai_failed" | "skipped" | "not_candidate" | "missing_reasoning" } {
  if (input.now.getTime() >= input.commenceTime.getTime()) return { action: "skip", reason: "too_late" };
  if (!input.parsed) return { action: "skip", reason: "ai_failed" };
  if (input.parsed.skip) return { action: "skip", reason: "skipped" };
  const reasoningRu = input.parsed.reasoning.ru.trim();
  const reasoningEn = input.parsed.reasoning.en.trim();
  if (!reasoningRu || !reasoningEn) return { action: "skip", reason: "missing_reasoning" };

  const match = input.candidates
    .filter(
      (row) =>
        row.market === input.parsed!.pick.market &&
        row.outcome === input.parsed!.pick.selection &&
        samePoint(row.point, input.parsed!.pick.point) &&
        row.bestPrice > 1,
    )
    .sort((left, right) => right.ev - left.ev)[0];
  if (!match) return { action: "skip", reason: "not_candidate" };

  return {
    action: "save",
    pick: {
      market: match.market,
      selection: match.outcome,
      point: match.point,
      price: match.bestPrice,
      bookmaker: match.bestBookmaker,
      modelProb: match.consensusProb,
      aiProb: input.parsed.ai_probability,
      ev: match.ev,
      confidence: input.parsed.confidence,
      reasoningRu,
      reasoningEn,
    },
  };
}

export function decideAiPickPublication(input: {
  now: Date;
  commenceTime: Date;
  publishedToday: number;
  dailyLimit: number;
  quote: CandidateQuote | null;
  decision: Pick<ConsensusDecision, "status" | "pick" | "pAiMean" | "confidence" | "reasoning">;
}): { action: "save"; pick: SavedPick } | { action: "skip"; reason: "too_late" | "no_consensus" | "daily_limit" | "missing_price" | "missing_reasoning" } {
  if (input.now.getTime() >= input.commenceTime.getTime()) return { action: "skip", reason: "too_late" };
  if (input.decision.status !== "consensus" || !input.decision.pick || input.decision.pAiMean == null || !input.decision.confidence) {
    return { action: "skip", reason: "no_consensus" };
  }
  if (input.publishedToday >= input.dailyLimit) return { action: "skip", reason: "daily_limit" };
  if (!input.quote || input.quote.bestPrice <= 1) return { action: "skip", reason: "missing_price" };
  const reasoningRu = input.decision.reasoning?.ru.trim() ?? "";
  const reasoningEn = input.decision.reasoning?.en.trim() ?? "";
  if (!reasoningRu || !reasoningEn) return { action: "skip", reason: "missing_reasoning" };

  return {
    action: "save",
    pick: {
      market: input.quote.market,
      selection: input.quote.outcome,
      point: input.quote.point,
      price: input.quote.bestPrice,
      bookmaker: input.quote.bestBookmaker,
      modelProb: input.quote.consensusProb,
      aiProb: input.decision.pAiMean,
      ev: input.decision.pAiMean * input.quote.bestPrice - 1,
      confidence: input.decision.confidence,
      reasoningRu,
      reasoningEn,
    },
  };
}
