import { describe, expect, it } from "vitest";
import { selectionBoard, type BoardEvaluation } from "./board";

function row(overrides: Partial<BoardEvaluation> & Pick<BoardEvaluation, "eventId" | "market">): BoardEvaluation {
  return {
    home: "Home",
    away: "Away",
    asymmetryScore: 0.64,
    asymmetryMarket: "h2h",
    ...overrides,
  };
}

describe("selectionBoard", () => {
  it("keeps one row per event and prefers the odds row over the selection placeholder", () => {
    const board = selectionBoard([
      row({ eventId: "later", market: "selection", asymmetryScore: 0.61 }),
      row({ eventId: "clasico", market: "selection", home: "Real Madrid", away: "Barcelona" }),
      row({ eventId: "clasico", market: "h2h", home: "Real Madrid", away: "Barcelona", dataScore: 7, asymmetryMarket: "totals" }),
      row({ eventId: "plain", market: "h2h", asymmetryScore: null, asymmetryMarket: null }),
    ]);

    expect(board.map((item) => item.eventId)).toEqual(["clasico", "later"]);
    expect(board[0]).toMatchObject({ home: "Real Madrid", dataScore: 7, asymmetryMarket: "totals", asymmetryScore: 0.64 });
    expect(board[1]?.asymmetryScore).toBe(0.61);
  });
});
