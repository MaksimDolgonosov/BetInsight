import { describe, expect, it } from "vitest";
import type { SportThresholds } from "@/server/domain/settings";
import { consensusProbability, evaluateQuotes, expectedValue, median, removeMargin } from "./evaluate";

describe("odds model", () => {
  it("removes the overround so probabilities sum to 1", () => {
    const fair = removeMargin([1.9, 1.9]);
    expect(fair[0]! + fair[1]!).toBeCloseTo(1);
    expect(fair[0]).toBeCloseTo(0.5);
  });

  it("gives Pinnacle a heavier vote in the median", () => {
    const plain = median([0.4, 0.6]);
    const weighted = consensusProbability([
      { bookmakerKey: "pinnacle", bookmaker: "Pinnacle", probability: 0.4 },
      { bookmakerKey: "other", bookmaker: "Other", probability: 0.6 },
    ]);
    expect(plain).toBeCloseTo(0.5);
    expect(weighted).toBeCloseTo(0.4);
  });

  it("calculates expected value from the consensus and the best price", () => {
    expect(expectedValue(0.54, 2.1)).toBeCloseTo(0.134);
  });

  it("marks a football outcome as a candidate only above the EV threshold", () => {
    const quotes = [
      quote("pinnacle", "Pinnacle", "home", 2.2),
      quote("pinnacle", "Pinnacle", "draw", 3.4),
      quote("pinnacle", "Pinnacle", "away", 3.6),
      quote("bet365", "Bet365", "home", 2.15),
      quote("bet365", "Bet365", "draw", 3.3),
      quote("bet365", "Bet365", "away", 3.5),
      quote("unibet", "Unibet", "home", 2.1),
      quote("unibet", "Unibet", "draw", 3.25),
      quote("unibet", "Unibet", "away", 3.55),
    ];

    const rows = evaluateQuotes(quotes, {
      evThreshold: 0.02,
      oddsMin: 1.5,
      oddsMax: 4,
      minBookmakers: 3,
      totalsPointMin: 0.5,
      totalsPointMax: 5.5,
      spreadsPointMin: -2.5,
      spreadsPointMax: 2.5,
      spreadsExcludedAbs: [],
    });
    const home = rows.find((row) => row.selection === "home");
    expect(home).toBeDefined();
    expect(home!.bookmakerCount).toBe(3);
    expect(home!.bestPrice).toBe(2.2);
    expect(home!.candidate).toBe(home!.ev > 0.02);
    expect(home!.nearMiss).toBe(!home!.candidate && home!.ev >= 0 && home!.ev <= 0.02);
  });

  it("keeps a priced outcome between zero and the threshold as a near miss", () => {
    const rows = evaluateQuotes(
      [
        quote("pinnacle", "Pinnacle", "home", 2),
        quote("pinnacle", "Pinnacle", "away", 2),
        quote("bet365", "Bet365", "home", 2),
        quote("bet365", "Bet365", "away", 2),
        quote("unibet", "Unibet", "home", 2.02),
        quote("unibet", "Unibet", "away", 1.98),
      ],
      {
        evThreshold: 0.02,
        oddsMin: 1.5,
        oddsMax: 4,
        minBookmakers: 3,
        totalsPointMin: 0.5,
        totalsPointMax: 5.5,
        spreadsPointMin: -2.5,
        spreadsPointMax: 2.5,
        spreadsExcludedAbs: [],
      },
    );

    expect(rows.every((row) => row.candidate === false)).toBe(true);
    expect(rows.every((row) => row.nearMiss === true)).toBe(true);
  });

  it("ignores basketball totals outside the configured point range", () => {
    const rows = evaluateQuotes(
      [
        quote("pinnacle", "Pinnacle", "over", 1.91, "totals", 2.5),
        quote("pinnacle", "Pinnacle", "under", 1.91, "totals", 2.5),
        quote("bet365", "Bet365", "over", 1.9, "totals", 2.5),
        quote("bet365", "Bet365", "under", 1.9, "totals", 2.5),
        quote("unibet", "Unibet", "over", 1.9, "totals", 2.5),
        quote("unibet", "Unibet", "under", 1.9, "totals", 2.5),
      ],
      {
        evThreshold: 0.02,
        oddsMin: 1.5,
        oddsMax: 4,
        minBookmakers: 3,
        totalsPointMin: 140,
        totalsPointMax: 190,
        spreadsPointMin: -20.5,
        spreadsPointMax: 20.5,
        spreadsExcludedAbs: [],
      },
    );

    expect(rows.every((row) => row.candidate === false)).toBe(true);
    expect(rows.every((row) => row.nearMiss === false)).toBe(true);
  });

  it("prices a two-outcome basketball moneyline without a draw", () => {
    const rows = evaluateQuotes(
      [
        quote("pinnacle", "Pinnacle", "home", 1.8),
        quote("pinnacle", "Pinnacle", "away", 2.05),
        quote("bet365", "Bet365", "home", 1.78),
        quote("bet365", "Bet365", "away", 2.02),
        quote("unibet", "Unibet", "home", 1.76),
        quote("unibet", "Unibet", "away", 2.08),
      ],
      {
        evThreshold: 0.02,
        oddsMin: 1.5,
        oddsMax: 4,
        minBookmakers: 3,
        totalsPointMin: 140,
        totalsPointMax: 190,
        spreadsPointMin: -20.5,
        spreadsPointMax: 20.5,
        spreadsExcludedAbs: [],
      },
    );

    expect(rows.map((row) => row.selection).sort()).toEqual(["away", "home"]);
    expect(rows.find((row) => row.selection === "home")!.consensusProb).toBeGreaterThan(0.5);
  });

  it("prices a handicap only from bookmakers on the same line", () => {
    const rows = evaluateQuotes(
      [
        ...pair("pinnacle", "Pinnacle", -1.5, 2.2, 1.7),
        ...pair("bet365", "Bet365", -1.5, 2.15, 1.72),
        ...pair("unibet", "Unibet", -1.5, 2.1, 1.74),
        ...pair("pinnacle", "Pinnacle", -2.5, 3.4, 1.3),
      ],
      limits(),
    );
    const home = rows.find((row) => row.selection === "home" && row.point === -1.5);
    const away = rows.find((row) => row.selection === "away" && row.point === 1.5);
    expect(home?.bookmakerCount).toBe(3);
    expect(away?.point).toBe(1.5);
    expect(home?.consensusProb).toBeLessThan(0.5);
    expect(rows.some((row) => row.point === -2.5 && row.candidate)).toBe(false);
    expect(rows.some((row) => row.point === -2.5 && row.bookmakerCount >= 3)).toBe(false);
  });

  it("drops a football handicap outside -2.5 to +2.5 and a tennis set handicap", () => {
    const wide = evaluateQuotes(pair("pinnacle", "Pinnacle", -3.5, 1.9, 1.9).concat(pair("bet365", "Bet365", -3.5, 1.9, 1.9), pair("unibet", "Unibet", -3.5, 1.9, 1.9)), limits());
    expect(wide.every((row) => row.candidate === false && row.nearMiss === false)).toBe(true);

    const sets = evaluateQuotes(
      pair("pinnacle", "Pinnacle", -1.5, 1.8, 2).concat(pair("bet365", "Bet365", -1.5, 1.8, 2), pair("unibet", "Unibet", -1.5, 1.8, 2)),
      limits({ spreadsPointMin: -8.5, spreadsPointMax: 8.5, spreadsExcludedAbs: [1.5], oddsMin: 1.4 }),
    );
    expect(sets.every((row) => row.candidate === false && row.nearMiss === false)).toBe(true);
  });
});

function limits(overrides: Partial<SportThresholds> = {}): SportThresholds {
  return {
    evThreshold: 0.02,
    oddsMin: 1.5,
    oddsMax: 4,
    minBookmakers: 3,
    totalsPointMin: 0.5,
    totalsPointMax: 5.5,
    spreadsPointMin: -2.5,
    spreadsPointMax: 2.5,
    spreadsExcludedAbs: [],
    ...overrides,
  };
}

function pair(bookmakerKey: string, bookmaker: string, homePoint: number, homePrice: number, awayPrice: number) {
  return [
    quote(bookmakerKey, bookmaker, "home", homePrice, "spreads", homePoint),
    quote(bookmakerKey, bookmaker, "away", awayPrice, "spreads", -homePoint),
  ];
}

function quote(
  bookmakerKey: string,
  bookmaker: string,
  selection: "home" | "draw" | "away" | "over" | "under",
  price: number,
  market: "h2h" | "totals" | "spreads" = "h2h",
  point: number | null = null,
) {
  return { bookmakerKey, bookmaker, market, selection, point, price };
}
