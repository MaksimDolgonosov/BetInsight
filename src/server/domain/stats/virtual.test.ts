import { describe, expect, it } from "vitest";
import { leadingVirtualPick, summarizeVirtual } from "./virtual";

describe("virtual no-consensus record", () => {
  it("uses the unique leading vote and ignores a tie", () => {
    expect(
      leadingVirtualPick([
        { market: "h2h", selection: "home", point: null },
        { market: "h2h", selection: "home", point: null },
        { market: "totals", selection: "over", point: 2.5 },
      ]),
    ).toEqual({ market: "h2h", selection: "home", point: null });
    expect(
      leadingVirtualPick([
        { market: "h2h", selection: "home", point: null },
        { market: "h2h", selection: "away", point: null },
      ]),
    ).toBeNull();
  });

  it("counts stake-1 results without treating voids as decisions", () => {
    const summary = summarizeVirtual([
      { status: "won", price: 2.1, profitUnits: 1.1 },
      { status: "lost", price: 1.8, profitUnits: -1 },
      { status: "void", price: 1.9, profitUnits: 0 },
      { status: "pending", price: 2, profitUnits: 0 },
    ]);
    expect(summary).toMatchObject({
      count: 4,
      won: 1,
      lost: 1,
      void: 1,
      pending: 1,
      decided: 2,
      hitRate: 0.5,
      profit: 0.1,
      roi: 0.05,
    });
    expect(summarizeVirtual([]).roi).toBeNull();
  });
});
