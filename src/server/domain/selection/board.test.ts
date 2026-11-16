import { describe, expect, it } from "vitest";
import { selectionBoard, type BoardEvaluation } from "./board";

function row(overrides: Partial<BoardEvaluation> & Pick<BoardEvaluation, "eventId" | "market">): BoardEvaluation {
  return {
    home: "Home",
    away: "Away",
    significanceScore: 30,
    formHome: 1,
    formAway: 0,
    formBonus: 15,
    finalScore: 45,
    formSource: "calculated",
    ...overrides,
  };
}

describe("selectionBoard", () => {
  it("keeps one row per event and prefers the odds row over the selection placeholder", () => {
    const board = selectionBoard([
      row({ eventId: "later", market: "selection", finalScore: 30, formBonus: 0, formSource: "insufficient_data" }),
      row({ eventId: "clasico", market: "selection", home: "Real Madrid", away: "Barcelona" }),
      row({ eventId: "clasico", market: "h2h", home: "Real Madrid", away: "Barcelona", dataScore: 7 }),
      row({ eventId: "plain", market: "h2h", finalScore: null }),
    ]);

    expect(board.map((item) => item.eventId)).toEqual(["clasico", "later"]);
    expect(board[0]).toMatchObject({ home: "Real Madrid", dataScore: 7, formSource: "calculated" });
    expect(board[1]?.formSource).toBe("insufficient_data");
  });
});