import { describe, expect, it } from "vitest";
import { asymmetryStrength, peakAsymmetry } from "./asymmetry";

describe("asymmetryStrength", () => {
  it("peaks at the middle of 50–70% and falls to zero at the edges", () => {
    expect(asymmetryStrength(0.6)).toBeCloseTo(1);
    expect(asymmetryStrength(0.55)).toBeCloseTo(0.5);
    expect(asymmetryStrength(0.65)).toBeCloseTo(0.5);
    expect(asymmetryStrength(0.5)).toBeCloseTo(0);
    expect(asymmetryStrength(0.7)).toBeCloseTo(0);
  });
});

describe("peakAsymmetry", () => {
  it("keeps a match whose strongest outcome is inside 50–70%", () => {
    const hit = peakAsymmetry([
      { market: "h2h", selection: "home", point: null, probability: 0.62 },
      { market: "h2h", selection: "draw", point: null, probability: 0.22 },
      { market: "h2h", selection: "away", point: null, probability: 0.16 },
      { market: "totals", selection: "over", point: 2.5, probability: 0.68 },
    ]);
    expect(hit).toMatchObject({ probability: 0.68, market: "totals", selection: "over", point: 2.5 });
  });

  it("rejects a match that is too obvious or too even", () => {
    expect(peakAsymmetry([{ market: "h2h", selection: "home", point: null, probability: 0.78 }])).toBeNull();
    expect(
      peakAsymmetry([
        { market: "h2h", selection: "home", point: null, probability: 0.48 },
        { market: "h2h", selection: "away", point: null, probability: 0.46 },
      ]),
    ).toBeNull();
  });
});
