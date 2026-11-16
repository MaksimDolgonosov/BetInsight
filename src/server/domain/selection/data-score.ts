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
  rows: readonly { eventId: string; aiPickShortlisted: boolean; dataScore?: number | null }[],
  thresholds: DataScoreThresholds = DEFAULT_DATA_SCORE_THRESHOLDS,
): string[] {
  const shortlisted = new Map<string, number>();
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (row.aiPickShortlisted) shortlisted.set(row.eventId, (shortlisted.get(row.eventId) ?? 0) + 1);
    if (typeof row.dataScore === "number") scores.set(row.eventId, row.dataScore);
  }
  return [...shortlisted.keys()]
    .filter((eventId) => (shortlisted.get(eventId) ?? 0) >= 2)
    .filter((eventId) => {
      const score = scores.get(eventId);
      return score != null && classifyDataScore(score, thresholds).action !== "discard";
    })
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
