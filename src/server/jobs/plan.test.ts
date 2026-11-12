import { describe, expect, it } from "vitest";
import type { CreditCoverage } from "@/server/budget/coverage";
import { claimDecision } from "@/server/jobs/claim";
import { planDay } from "@/server/jobs/plan";
import { isoWeekKey, mskDate } from "@/server/jobs/time";
import { mapScores, mapTrackedSports } from "@/server/integrations/odds-api/schema";
import { LEAGUE_CATALOG } from "@/server/domain/settings";

describe("data job plan", () => {
  const now = new Date("2026-11-08T03:00:00.000Z");

  it("uses the Moscow date and queues odds four hours before the first match", () => {
    expect(mskDate(now)).toBe("2026-11-08");
    const calls = planDay({
      now,
      leagues: [{ key: "soccer_spain_la_liga" }],
      events: [
        { sportKey: "soccer_spain_la_liga", commenceTime: "2026-11-08T16:00:00.000Z", status: "scheduled" },
        { sportKey: "soccer_spain_la_liga", commenceTime: "2026-11-08T20:00:00.000Z", status: "scheduled" },
        { sportKey: "soccer_spain_la_liga", commenceTime: "2026-11-08T22:30:00.000Z", status: "scheduled" },
      ],
    });

    expect(calls.map((call) => call.purpose)).toEqual(["opening", "closing"]);
    expect(calls[0]?.notBefore.toISOString()).toBe("2026-11-08T12:00:00.000Z");
    expect(calls[1]?.notBefore.toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });

  it("retries unsettled scores and ignores matches that already started", () => {
    const calls = planDay({
      now,
      leagues: [{ key: "basketball_nba" }],
      events: [
        { sportKey: "basketball_nba", commenceTime: "2026-11-08T01:00:00.000Z", status: "scheduled" },
        { sportKey: "basketball_nba", commenceTime: "2026-11-07T18:00:00.000Z", status: "live" },
      ],
    });

    expect(calls).toEqual([
      {
        job: "fetch-scores",
        sportKey: "basketball_nba",
        day: "2026-11-08",
        purpose: "retry",
        notBefore: now,
      },
    ]);
  });

  it("queues one pre-start odds request and drops tennis when the mandatory credits do not fit", () => {
    const calls = planDay({
      now,
      leagues: [{ key: "soccer_spain_la_liga" }, { key: "tennis_atp_paris" }],
      coverage: coverage(),
      events: [
        { sportKey: "soccer_spain_la_liga", commenceTime: "2026-11-08T16:00:00.000Z", status: "scheduled" },
        { sportKey: "tennis_atp_paris", commenceTime: "2026-11-08T12:00:00.000Z", status: "scheduled" },
      ],
    });

    expect(calls.map((call) => `${call.job}:${call.sportKey}`)).toEqual([
      "fetch-odds:soccer_spain_la_liga",
      "fetch-closing-odds:soccer_spain_la_liga",
      "fetch-scores:soccer_spain_la_liga",
    ]);
    expect(calls[0]?.markets).toEqual(["h2h", "totals"]);
    expect(calls[1]?.notBefore.toISOString()).toBe("2026-11-08T15:40:00.000Z");
  });
});

function coverage(): CreditCoverage {
  return {
    remaining: 57,
    reserveCredits: 50,
    markets: ["h2h", "totals", "spreads"],
    leagueDays: 2,
    closingCreditsUsed: 0,
    futureDays: [
      {
        sportKey: "soccer_spain_la_liga",
        day: "2026-11-08",
        firstCommence: "2026-11-08T16:00:00.000Z",
        oddsPaid: false,
        scoresPaid: false,
      },
      {
        sportKey: "tennis_atp_paris",
        day: "2026-11-08",
        firstCommence: "2026-11-08T12:00:00.000Z",
        oddsPaid: false,
        scoresPaid: false,
      },
    ],
  };
}

describe("job claim", () => {
  const now = new Date("2026-11-08T03:00:00.000Z");

  it("runs once and lets a failed or stale run try again", () => {
    expect(claimDecision(null, now)).toBe("insert");
    expect(claimDecision({ status: "succeeded", startedAt: now.toISOString() }, now)).toBe("duplicate");
    expect(claimDecision({ status: "failed", startedAt: now.toISOString() }, now)).toBe("retry");
    expect(claimDecision({ status: "running", startedAt: now.toISOString() }, now)).toBe("busy");
    expect(
      claimDecision({ status: "running", startedAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString() }, now),
    ).toBe("retry");
  });
});

describe("odds catalog and scores", () => {
  it("keeps the configured leagues and active tennis without outrights", () => {
    const { sports, valid } = mapTrackedSports(
      [
        { key: "soccer_spain_la_liga", group: "Soccer", title: "La Liga", active: true, has_outrights: false },
        { key: "tennis_atp_paris_masters", group: "Tennis", title: "ATP Paris Masters", active: true, has_outrights: false },
        { key: "tennis_wta_finals", group: "Tennis", title: "WTA Finals", active: false, has_outrights: false },
        { key: "tennis_atp_outrights", group: "Tennis", title: "ATP Outrights", active: true, has_outrights: true },
        { key: "icehockey_nhl", group: "Ice Hockey", title: "NHL", active: true, has_outrights: false },
        { key: "icehockey_ahl", group: "Ice Hockey", title: "AHL", active: true, has_outrights: false },
        { key: "americanfootball_nfl", group: "American Football", title: "NFL", active: true, has_outrights: false },
      ],
      LEAGUE_CATALOG.map((league) => league.key),
    );

    expect(valid).toBe(true);
    expect(sports.map((sport) => sport.key)).toEqual(["soccer_spain_la_liga", "tennis_atp_paris_masters", "icehockey_nhl"]);
    expect(sports.find((sport) => sport.key === "icehockey_nhl")?.group).toBe("hockey");
    expect(isoWeekKey("2024-12-31")).toBe("2025-W01");
  });

  it("reads completed scores by team name", () => {
    const { events, valid } = mapScores([
      {
        id: "evt",
        sport_key: "soccer_spain_la_liga",
        commence_time: "2026-11-08T16:00:00.000Z",
        completed: true,
        home_team: "Barcelona",
        away_team: "Sevilla",
        scores: [
          { name: "Barcelona", score: "2" },
          { name: "Sevilla", score: "1" },
        ],
      },
    ]);

    expect(valid).toBe(true);
    expect(events[0]).toMatchObject({ homeScore: 2, awayScore: 1, completed: true });
  });
});
