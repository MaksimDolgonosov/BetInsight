import { describe, expect, it } from "vitest";
import { shortlistPricesReady, voteShortlist, type VoteMarketOutcome } from "./vote-shortlist";

function outcome(overrides: Partial<VoteMarketOutcome> & Pick<VoteMarketOutcome, "selection" | "consensusProb" | "bestPrice">): VoteMarketOutcome {
  return {
    market: "h2h",
    point: null,
    bestBookmaker: "Pinnacle",
    ev: -0.04,
    ...overrides,
  };
}

describe("voteShortlist", () => {
  it("takes the three most probable outcomes and ignores price and EV gates", () => {
    const selected = voteShortlist({
      sportGroup: "soccer",
      outcomes: [
        outcome({ selection: "home", consensusProb: 0.22, bestPrice: 4.4, ev: -0.2 }),
        outcome({ selection: "away", consensusProb: 0.61, bestPrice: 1.3, ev: -0.2 }),
        outcome({ market: "totals", selection: "over", point: 2.5, consensusProb: 0.54, bestPrice: 1.9, ev: 0.02 }),
        outcome({ market: "spreads", selection: "home", point: -0.5, consensusProb: 0.48, bestPrice: 1.8, ev: -0.1 }),
        outcome({ market: "selection", selection: "event", consensusProb: 0, bestPrice: 1, ev: 0, bestBookmaker: "—" }),
      ],
    });

    expect(selected.map((item) => `${item.market}:${item.selection}`)).toEqual(["h2h:away", "totals:over", "spreads:home"]);
    expect(shortlistPricesReady(selected)).toBe(true);
  });

  it("uses head-to-head when the book has not priced the match", () => {
    const soccer = voteShortlist({ sportGroup: "soccer", outcomes: [] });
    const nba = voteShortlist({ sportGroup: "nba", outcomes: [] });

    expect(soccer.map((item) => item.selection)).toEqual(["home", "draw", "away"]);
    expect(nba.map((item) => item.selection)).toEqual(["home", "away"]);
    expect(shortlistPricesReady(soccer)).toBe(false);
  });

  it("drops an unpriced draw when home and away already have prices", () => {
    const selected = voteShortlist({
      sportGroup: "soccer",
      outcomes: [
        outcome({ selection: "home", consensusProb: 0.46, bestPrice: 2.1 }),
        outcome({ selection: "away", consensusProb: 0.3, bestPrice: 3.4 }),
      ],
    });

    expect(selected.map((item) => item.selection)).toEqual(["home", "away"]);
    expect(shortlistPricesReady(selected)).toBe(true);
  });
});
