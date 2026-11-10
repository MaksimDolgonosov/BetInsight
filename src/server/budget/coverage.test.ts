import { describe, expect, it } from "vitest";
import { buildCreditCoverage, closingLeagueDays, marketsForRequest, shouldDropTennis, type CreditCoverage, type FutureLeagueDay } from "./coverage";

const markets = ["h2h", "totals", "spreads"] as const;

describe("credit coverage", () => {
  it("keeps the handicap and leaves 100 credits for pre-start odds at 70 league-days", () => {
    const coverage = month(70, 500, 0);
    expect(marketsForRequest(coverage)).toEqual(["h2h", "totals", "spreads"]);
    expect(closingRoom(coverage, marketsForRequest(coverage))).toBe(100);
  });

  it("takes 5 credits from the pre-start budget for each extra league-day", () => {
    expect(closingRoom(month(70, 500, 0), [...markets])).toBe(100);
    expect(closingRoom(month(71, 500, 0), [...markets])).toBe(95);
  });

  it("turns pre-start odds off at 90 league-days even when credits remain", () => {
    const coverage = month(90, 2000, 0);
    expect(closingLeagueDays(coverage, [...markets], "2026-11-01")).toEqual([]);
  });

  it("drops the handicap before tennis when the mandatory requests do not fit", () => {
    const days = [
      ...Array.from({ length: 60 }, (_, index) => day("soccer_spain_la_liga", index)),
      ...Array.from({ length: 10 }, (_, index) => day("tennis_atp_paris", index)),
    ];
    const tight = base(days, 300);
    expect(marketsForRequest(tight)).toEqual(["h2h", "totals"]);
    expect(shouldDropTennis(tight, ["h2h", "totals"])).toBe(true);

    const spreadsOnly = base(days, 340);
    expect(marketsForRequest(spreadsOnly)).toEqual(["h2h", "totals"]);
    expect(shouldDropTennis(spreadsOnly, marketsForRequest(spreadsOnly))).toBe(false);
  });

  it("counts paid odds and pre-start credits from the usage log", () => {
    const coverage = buildCreditCoverage({
      today: "2026-11-08",
      month: "2026-11",
      monthlyLimit: 500,
      reserveCredits: 50,
      markets: [...markets],
      now: new Date("2026-11-08T03:00:00.000Z"),
      usage: [
        {
          cost: 3,
          remaining: 497,
          createdAt: new Date("2026-11-08T02:00:00.000Z"),
          endpoint: "GET /v4/sports/basketball_nba/odds",
          params: { sportKey: "basketball_nba", day: "2026-11-08", purpose: "opening" },
        },
        {
          cost: 3,
          remaining: 494,
          createdAt: new Date("2026-11-07T12:00:00.000Z"),
          endpoint: "GET /v4/sports/soccer_uefa_champs_league/odds",
          params: { sportKey: "soccer_uefa_champs_league", day: "2026-11-07", purpose: "prestart" },
        },
      ],
      events: [
        { sportKey: "basketball_nba", day: "2026-11-08", commenceTime: "2026-11-08T18:00:00.000Z" },
        { sportKey: "soccer_spain_la_liga", day: "2026-11-08", commenceTime: "2026-11-08T16:00:00.000Z" },
      ],
    });

    expect(coverage.leagueDays).toBe(3);
    expect(coverage.closingCreditsUsed).toBe(3);
    expect(coverage.futureDays.find((item) => item.sportKey === "basketball_nba")?.oddsPaid).toBe(true);
    expect(closingLeagueDays(coverage, [...markets], "2026-11-08").map((item) => item.sportKey)).toEqual([
      "basketball_nba",
      "soccer_spain_la_liga",
    ]);
  });
});

function month(leagueDays: number, remaining: number, closingCreditsUsed: number): CreditCoverage {
  const days = Array.from({ length: leagueDays }, (_, index) => day("soccer_spain_la_liga", index));
  return { ...base(days, remaining), closingCreditsUsed, leagueDays };
}

function base(days: FutureLeagueDay[], remaining: number): CreditCoverage {
  return {
    remaining,
    reserveCredits: 50,
    markets: [...markets],
    leagueDays: days.length,
    closingCreditsUsed: 0,
    futureDays: days,
  };
}

function day(sportKey: string, index: number): FutureLeagueDay {
  const date = String((index % 28) + 1).padStart(2, "0");
  return {
    sportKey,
    day: `2026-11-${date}`,
    firstCommence: `2026-11-${date}T16:00:00.000Z`,
    oddsPaid: false,
    scoresPaid: false,
  };
}

function closingRoom(input: CreditCoverage, requestMarkets: CreditCoverage["markets"]): number {
  const mandatory = input.futureDays.length * (requestMarkets.length + 2);
  return Math.min(100 - input.closingCreditsUsed, input.remaining - input.reserveCredits - mandatory);
}
