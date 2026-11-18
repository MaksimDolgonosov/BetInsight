import { describe, expect, it } from "vitest";
import { decideAiPickPublication, predictionHash } from "./publish";

const kickoff = new Date("2026-11-08T18:00:00.000Z");
const before = new Date("2026-11-08T12:00:00.000Z");
const candidate = {
  market: "h2h",
  outcome: "home",
  point: null,
  consensusProb: 0.54,
  bestPrice: 2.1,
  bestBookmaker: "Pinnacle",
  ev: 0.134,
};

describe("prediction publication", () => {
  it("hashes the same forecast to the same value", () => {
    const input = {
      eventId: "evt",
      home: "Home",
      away: "Away",
      commenceTime: kickoff.toISOString(),
      track: "ai_pick" as const,
      market: "h2h",
      selection: "home",
      point: null,
      price: 2.1,
      bookmaker: "Pinnacle",
      publishedAt: before.toISOString(),
    };
    expect(predictionHash(input)).toBe(predictionHash(input));
    expect(predictionHash({ ...input, price: 2.2 })).not.toBe(predictionHash(input));
  });

  it("saves an AI-pick forecast only under the daily cap and before kickoff", () => {
    const decision = {
      status: "consensus" as const,
      pick: { market: "h2h" as const, selection: "home" as const, point: null },
      pAiMean: 0.56,
      confidence: "medium" as const,
      reasoning: { ru: "Две модели согласны.", en: "Two models agree." },
    };
    const saved = decideAiPickPublication({
      now: before,
      commenceTime: kickoff,
      publishedToday: 2,
      dailyLimit: 3,
      quote: candidate,
      decision,
    });
    expect(saved.action).toBe("save");
    if (saved.action === "save") expect(saved.pick.reasoningEn).toBe("Two models agree.");
    expect(
      decideAiPickPublication({
        now: before,
        commenceTime: kickoff,
        publishedToday: 3,
        dailyLimit: 3,
        quote: candidate,
        decision,
      }),
    ).toEqual({ action: "skip", reason: "daily_limit" });
  });
});
