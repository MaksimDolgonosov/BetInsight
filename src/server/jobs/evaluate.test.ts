import { describe, expect, it } from "vitest";
import { evaluateLeague } from "./evaluate";

describe("evaluateLeague", () => {
  it("returns no rows when a league has no quotes", () => {
    expect(
      evaluateLeague({
        events: [],
        thresholds: thresholds,
        aiPick: { oddsMin: 1.5, oddsMax: 4, minEv: 0.02, shortlistSize: 3 },
      }),
    ).toEqual([]);
  });

  it("keeps candidate and near-miss flags and marks the shortlist", () => {
    const rows = evaluateLeague({
      events: [
        {
          id: "evt",
          home: "Home",
          away: "Away",
          quotes: [
            quote("pinnacle", "Pinnacle", "home", 2.2),
            quote("pinnacle", "Pinnacle", "draw", 3.4),
            quote("pinnacle", "Pinnacle", "away", 3.6),
            quote("bet365", "Bet365", "home", 2.15),
            quote("bet365", "Bet365", "draw", 3.3),
            quote("bet365", "Bet365", "away", 3.5),
            quote("unibet", "Unibet", "home", 2.1),
            quote("unibet", "Unibet", "draw", 3.25),
            quote("unibet", "Unibet", "away", 3.55),
          ],
        },
      ],
      thresholds,
      aiPick: { oddsMin: 1.5, oddsMax: 4, minEv: 0.02, shortlistSize: 3 },
    });

    const home = rows.find((row) => row.outcome === "home");
    expect(home).toBeDefined();
    expect(home!.eventId).toBe("evt");
    expect(home!.isCandidate).toBe(home!.ev > 0.02);
    expect(home!.nearMiss).toBe(!home!.isCandidate && home!.ev >= 0 && home!.ev <= 0.02);
    expect(rows.every((row) => row.isCandidate !== row.nearMiss || (!row.isCandidate && !row.nearMiss))).toBe(true);
    expect(rows.some((row) => row.aiPickShortlisted)).toBe(home!.isCandidate);
  });
});

const thresholds = {
  evThreshold: 0.02,
  oddsMin: 1.5,
  oddsMax: 4,
  minBookmakers: 3,
  totalsPointMin: 0.5,
  totalsPointMax: 5.5,
  spreadsPointMin: -2.5,
  spreadsPointMax: 2.5,
  spreadsExcludedAbs: [],
};

function quote(
  bookmakerKey: string,
  bookmaker: string,
  selection: "home" | "draw" | "away",
  price: number,
) {
  return { bookmakerKey, bookmaker, market: "h2h" as const, selection, point: null, price };
}
