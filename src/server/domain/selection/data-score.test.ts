import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_SCORE_THRESHOLDS } from "./constants";
import { classifyDataScore, eventsReadyForVote, gateByDataScore } from "./data-score";

describe("classifyDataScore", () => {
  const thresholds = DEFAULT_DATA_SCORE_THRESHOLDS;

  it("sends 6 and above to the vote", () => {
    expect(classifyDataScore(6, thresholds)).toEqual({ action: "vote", lowConfidence: false, discardReason: null });
    expect(classifyDataScore(10, thresholds).action).toBe("vote");
  });

  it("keeps 4 and 5 with the low-confidence flag", () => {
    expect(classifyDataScore(4, thresholds)).toEqual({ action: "low_confidence", lowConfidence: true, discardReason: null });
    expect(classifyDataScore(5, thresholds).action).toBe("low_confidence");
  });

  it("discards 3 and below", () => {
    expect(classifyDataScore(3, thresholds)).toEqual({
      action: "discard",
      lowConfidence: false,
      discardReason: "data_score_below_threshold",
    });
    expect(classifyDataScore(Number.NaN, thresholds).action).toBe("discard");
  });

  it("keeps a research discard reason when the score is too low", () => {
    expect(gateByDataScore({ dataScore: 2, modelDiscardReason: " no injuries or lineups " }).discardReason).toBe(
      "no injuries or lineups",
    );
    expect(gateByDataScore({ dataScore: 8, modelDiscardReason: "ignored" }).action).toBe("vote");
  });
});

describe("eventsReadyForVote", () => {
  it("queues a shortlisted event only after the data score clears the discard line", () => {
    const rows = [
      { eventId: "thin", aiPickShortlisted: true, dataScore: 4 },
      { eventId: "thin", aiPickShortlisted: true, dataScore: 4 },
      { eventId: "empty", aiPickShortlisted: true, dataScore: 3 },
      { eventId: "empty", aiPickShortlisted: true, dataScore: 3 },
      { eventId: "waiting", aiPickShortlisted: true, dataScore: null },
      { eventId: "waiting", aiPickShortlisted: true },
      { eventId: "lone", aiPickShortlisted: true, dataScore: 9 },
    ];
    expect(eventsReadyForVote(rows)).toEqual(["thin"]);
  });
});
