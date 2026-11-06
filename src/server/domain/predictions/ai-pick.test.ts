import { describe, expect, it } from "vitest";
import type { AiPickRow, ModelVoteInput } from "./ai-pick";
import { decideConsensus, marketFavoriteKey, outcomeKey, selectAiPickShortlist } from "./ai-pick";

const options = {
  oddsMin: 1.4,
  oddsMax: 2.5,
  minEv: -0.03,
  minBookmakers: 3,
  outcomesPerEvent: 3,
  eventLimit: 8,
};

describe("selectAiPickShortlist", () => {
  it("keeps the most probable priced outcomes and ranks events by EV", () => {
    const selected = selectAiPickShortlist(
      [
        row("late", "home", 0.62, 1.7, 0.01, 4),
        row("late", "away", 0.38, 2.4, -0.02, 4),
        row("late", "over", 0.2, 1.9, 0.2, 4, "totals", 2.5),
        row("early", "home", 0.55, 1.9, 0.08, 3),
        row("early", "away", 0.45, 2.1, 0.04, 3),
        row("thin", "home", 0.7, 1.3, 0.1, 5),
        row("thin", "away", 0.3, 3.4, -0.1, 5),
      ],
      options,
    );

    const events = [...new Set(selected.map((item) => item.eventId))];
    expect(events).toEqual(["late", "early"]);
    expect(selected.filter((item) => item.eventId === "late").map((item) => item.selection)).toEqual(["home", "away", "over"]);
  });

  it("drops an event that has only one eligible outcome", () => {
    const selected = selectAiPickShortlist(
      [row("solo", "home", 0.6, 1.8, 0.02, 3), row("solo", "away", 0.4, 3.2, 0.2, 3)],
      options,
    );
    expect(selected).toEqual([]);
  });
});

describe("decideConsensus", () => {
  const prices = [{ key: outcomeKey({ market: "h2h", selection: "home", point: null }), price: 1.8 }];
  const favorite = outcomeKey({ market: "h2h", selection: "home", point: null });

  it("publishes when two of three agree and the price stays fair", () => {
    const decision = decideConsensus({
      votes: [vote("alpha", "home", 0.6, "high"), vote("beta", "home", 0.55, "low"), vote("gamma", "away", 0.42, "medium")],
      modelCount: 3,
      mode: "two_thirds",
      prices,
      tolerance: 0.02,
      marketFavoriteKey: favorite,
    });

    expect(decision.status).toBe("consensus");
    expect(decision.votesFor).toBe(2);
    expect(decision.pick?.selection).toBe("home");
    expect(decision.confidence).toBe("medium");
    expect(decision.reasoningModel).toBe("alpha");
    expect(decision.matchesMarketFavorite).toBe(true);
    expect(decision.pAiMin).toBeGreaterThanOrEqual(0.4);
  });

  it("rejects a strong disagreement below 0.4", () => {
    const dissenter = vote("gamma", "away", 0.7, "low");
    dissenter.probabilities = [
      { market: "h2h", selection: "home", point: null, p: 0.3 },
      { market: "h2h", selection: "away", point: null, p: 0.7 },
    ];
    const decision = decideConsensus({
      votes: [vote("alpha", "home", 0.7, "high"), vote("beta", "home", 0.6, "medium"), dissenter],
      modelCount: 3,
      mode: "two_thirds",
      prices,
      tolerance: 0.02,
      marketFavoriteKey: favorite,
    });
    expect(decision.status).toBe("no_consensus");
  });

  it("requires every model when the mode is unanimous", () => {
    const decision = decideConsensus({
      votes: [vote("alpha", "home", 0.6, "high"), vote("beta", "home", 0.6, "high"), vote("gamma", "away", 0.5, "high")],
      modelCount: 3,
      mode: "unanimous",
      prices,
      tolerance: 0.02,
      marketFavoriteKey: null,
    });
    expect(decision.status).toBe("no_consensus");
  });

  it("marks full agreement with solid confidence as high", () => {
    const decision = decideConsensus({
      votes: [vote("alpha", "home", 0.6, "medium"), vote("beta", "home", 0.58, "high"), vote("gamma", "home", 0.57, "medium")],
      modelCount: 3,
      mode: "two_thirds",
      prices,
      tolerance: 0.02,
      marketFavoriteKey: favorite,
    });
    expect(decision.status).toBe("consensus");
    expect(decision.confidence).toBe("high");
    expect(decision.reasoningModel).toBe("beta");
  });
});

describe("marketFavoriteKey", () => {
  it("picks the outcome with the highest consensus probability", () => {
    expect(
      marketFavoriteKey([
        { market: "h2h", selection: "away", point: null, consensusProb: 0.4 },
        { market: "h2h", selection: "home", point: null, consensusProb: 0.6 },
      ]),
    ).toBe("h2h:home:");
  });
});

function row(
  eventId: string,
  selection: AiPickRow["selection"],
  consensusProb: number,
  bestPrice: number,
  ev: number,
  bookmakerCount: number,
  market: AiPickRow["market"] = "h2h",
  point: number | null = null,
): AiPickRow {
  return {
    eventId,
    market,
    selection,
    point,
    consensusProb,
    bestPrice,
    bestBookmaker: "Pinnacle",
    ev,
    bookmakerCount,
    candidate: false,
    nearMiss: false,
  };
}

function vote(model: string, selection: "home" | "away", homeProbability: number, confidence: ModelVoteInput["confidence"]): ModelVoteInput {
  return {
    model,
    pick: { market: "h2h", selection, point: null },
    probabilities: [
      { market: "h2h", selection: "home", point: null, p: selection === "home" ? homeProbability : 1 - homeProbability },
      { market: "h2h", selection: "away", point: null, p: selection === "away" ? homeProbability : Math.max(0.4, 1 - homeProbability) },
    ],
    confidence,
    reasoning: { ru: `${model} ru`, en: `${model} en` },
  };
}
