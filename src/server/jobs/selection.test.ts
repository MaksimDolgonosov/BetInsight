import { describe, expect, it } from "vitest";
import { attachResearchScores, reviewSelection } from "./selection";

const NOW = new Date("2026-11-16T03:00:00.000Z");

describe("reviewSelection", () => {
  it("drops a match outside the window even when its price is inside the band", () => {
    const review = reviewSelection({
      now: NOW,
      window: { minHours: 4, maxHours: 24 },
      range: { min: 0.6, max: 0.7 },
      leagueQuota: 2,
      voteWindow: { startHour: 8, endHour: 20 },
      events: [
        {
          eventId: "early",
          sportKey: "soccer_spain_la_liga",
          home: "Home",
          away: "Away",
          commenceTime: new Date("2026-11-16T05:00:00.000Z"),
          outcomes: [{ market: "h2h", selection: "home", point: null, probability: 0.65 }],
        },
        {
          eventId: "later",
          sportKey: "soccer_spain_la_liga",
          home: "Home",
          away: "Away",
          commenceTime: new Date("2026-11-16T18:00:00.000Z"),
          outcomes: [{ market: "totals", selection: "over", point: 2.5, probability: 0.66 }],
        },
      ],
    });
    expect(review.selected.map((event) => event.eventId)).toEqual(["later"]);
    expect(review.selected[0]).toMatchObject({ asymmetryMarket: "totals", asymmetryScore: 0.66 });
  });
});

describe("attachResearchScores", () => {
  it("keeps the research stamp when odds rows replace the selection placeholder", () => {
    const rows = attachResearchScores(
      [{ eventId: "madrid", market: "h2h" }],
      [{ eventId: "madrid", dataScore: 4, researchSummary: "Thin lineup news.", discardReason: null, lowConfidence: true }],
    );
    expect(rows[0]).toMatchObject({ market: "h2h", dataScore: 4, lowConfidence: true, researchSummary: "Thin lineup news." });
  });
});
