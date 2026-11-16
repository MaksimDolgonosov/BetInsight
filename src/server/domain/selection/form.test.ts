import { describe, expect, it } from "vitest";
import { assessForm, finalScore, formScore } from "./form";

describe("formScore", () => {
  it("weights the five newest results and ignores the rest", () => {
    expect(formScore(["W", "W", "W", "W", "W"])).toBeCloseTo(1, 5);
    expect(formScore(["L", "L", "L", "L", "L"])).toBe(0);
    expect(formScore(["W"])).toBeCloseTo(0.35, 5);
    expect(formScore(["D"])).toBeCloseTo(0.14, 5);
    expect(formScore(["L", "W", "W", "W", "W", "W"])).toBeCloseTo(0.65, 5);
    expect(formScore([])).toBe(0);
  });
});

describe("assessForm", () => {
  it("turns form asymmetry into a bonus from 0 to 15", () => {
    const assessed = assessForm(["W", "W", "W", "W", "W"], ["L", "L", "L", "L", "L"]);
    expect(assessed.formSource).toBe("calculated");
    expect(assessed.formHome).toBeCloseTo(1, 3);
    expect(assessed.formAway).toBe(0);
    expect(assessed.formDelta).toBeCloseTo(1, 3);
    expect(assessed.formBonus).toBe(15);
    expect(finalScore(30, assessed.formBonus)).toBe(45);
  });

  it("rounds a fractional gap to the nearest bonus point", () => {
    const assessed = assessForm(["W", "D", "L"], ["L", "L", "L"]);
    expect(assessed.formHome).toBeCloseTo(0.45, 3);
    expect(assessed.formBonus).toBe(7);
  });

  it("zeroes the bonus when either side has fewer than three matches", () => {
    const assessed = assessForm(["W", "W"], ["L", "L", "L", "L", "L"]);
    expect(assessed.formSource).toBe("insufficient_data");
    expect(assessed.formHome).toBeCloseTo(0.6, 3);
    expect(assessed.formBonus).toBe(0);
    expect(finalScore(40, assessed.formBonus)).toBe(40);
  });
});
