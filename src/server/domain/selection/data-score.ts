import { DEFAULT_DATA_SCORE_THRESHOLDS } from "./constants";

export type DataScoreThresholds = {
  voteMin: number;
  lowConfidenceMin: number;
};

export type DataScoreAction = "vote" | "low_confidence" | "discard";

export type DataScoreDecision = {
  action: DataScoreAction;
  lowConfidence: boolean;
  discardReason: string | null;
};

export function classifyDataScore(
  dataScore: number,
  thresholds: DataScoreThresholds = DEFAULT_DATA_SCORE_THRESHOLDS,
): DataScoreDecision {
  if (!Number.isFinite(dataScore) || dataScore < thresholds.lowConfidenceMin) {
    return { action: "discard", lowConfidence: false, discardReason: "data_score_below_threshold" };
  }
  if (dataScore < thresholds.voteMin) {
    return { action: "low_confidence", lowConfidence: true, discardReason: null };
  }
  return { action: "vote", lowConfidence: false, discardReason: null };
}

export function eventsReadyForVote(
  rows: readonly { eventId: string; dataScore?: number | null }[],
  thresholds: DataScoreThresholds = DEFAULT_DATA_SCORE_THRESHOLDS,
): string[] {
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (typeof row.dataScore === "number") scores.set(row.eventId, row.dataScore);
  }
  return [...scores.keys()]
    .filter((eventId) => classifyDataScore(scores.get(eventId) ?? Number.NaN, thresholds).action !== "discard")
    .sort();
}

export function gateByDataScore(input: {
  dataScore: number;
  modelDiscardReason?: string | null;
  thresholds?: DataScoreThresholds;
}): DataScoreDecision {
  const decision = classifyDataScore(input.dataScore, input.thresholds);
  if (decision.action !== "discard") return decision;
  const reason = input.modelDiscardReason?.trim();
  return reason ? { ...decision, discardReason: reason } : decision;
}
