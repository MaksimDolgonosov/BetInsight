import { describe, expect, it } from "vitest";
import { inferLeagueClass, isDerby, significanceScore } from "./significance";

const standing = (tableRank: number | null, isRelegation = false) => ({ tableRank, isRelegation });

describe("significanceScore", () => {
  it("scores league base, stage, table, and derby, then caps at 100", () => {
    expect(
      significanceScore({
        leagueClass: "la_liga",
        stage: null,
        home: standing(1),
        away: standing(4),
        isDerby: false,
      }),
    ).toBe(50);

    expect(
      significanceScore({
        leagueClass: "la_liga",
        stage: null,
        home: standing(2),
        away: standing(8),
        isDerby: true,
      }),
    ).toBe(55);

    expect(
      significanceScore({
        leagueClass: "bundesliga",
        stage: null,
        home: standing(17, true),
        away: standing(18, true),
        isDerby: false,
      }),
    ).toBe(45);

    expect(
      significanceScore({
        leagueClass: "ucl",
        stage: "final",
        home: standing(1, true),
        away: standing(2, true),
        isDerby: true,
      }),
    ).toBe(100);
  });

  it("adds the stage bonus on top of the competition base", () => {
    expect(significanceScore({ leagueClass: "ucl", stage: "semifinal", home: null, away: null, isDerby: false })).toBe(60);
    expect(significanceScore({ leagueClass: "nba_playoffs", stage: "quarterfinal", home: null, away: null, isDerby: false })).toBe(45);
    expect(significanceScore({ leagueClass: "nba_playoffs", stage: "round_of_16", home: null, away: null, isDerby: false })).toBe(45);
    expect(significanceScore({ leagueClass: "euroleague_final", stage: "final", home: null, away: null, isDerby: false })).toBe(65);
    expect(significanceScore({ leagueClass: "nba", stage: null, home: null, away: null, isDerby: false })).toBe(30);
    expect(significanceScore({ leagueClass: "nhl", stage: null, home: null, away: null, isDerby: false })).toBe(30);
    expect(significanceScore({ leagueClass: "nhl_playoffs", stage: "semifinal", home: null, away: null, isDerby: false })).toBe(50);
    expect(significanceScore({ leagueClass: "nba_finals", stage: "final", home: null, away: null, isDerby: false })).toBe(65);
    expect(significanceScore({ leagueClass: "nhl_finals", stage: "final", home: null, away: null, isDerby: false })).toBe(65);
    expect(significanceScore({ leagueClass: "grand_slam", stage: null, home: null, away: null, isDerby: false })).toBe(35);
  });

  it("does not award a top-four or relegation bonus from a single club", () => {
    expect(significanceScore({ leagueClass: "la_liga", stage: null, home: standing(4), away: standing(5), isDerby: false })).toBe(40);
    expect(significanceScore({ leagueClass: "la_liga", stage: null, home: standing(18, true), away: standing(10), isDerby: false })).toBe(30);
    expect(significanceScore({ leagueClass: "la_liga", stage: null, home: null, away: null, isDerby: false })).toBe(30);
    expect(significanceScore({ leagueClass: "unlisted", stage: null, home: null, away: null, isDerby: false })).toBe(0);
  });
});

describe("inferLeagueClass", () => {
  it("maps the catalog leagues and tennis tiers", () => {
    expect(inferLeagueClass("soccer_uefa_champs_league")).toBe("ucl");
    expect(inferLeagueClass("soccer_spain_la_liga")).toBe("la_liga");
    expect(inferLeagueClass("soccer_germany_bundesliga")).toBe("bundesliga");
    expect(inferLeagueClass("basketball_euroleague")).toBe("euroleague");
    expect(inferLeagueClass("basketball_euroleague", { stage: "final" })).toBe("euroleague_final");
    expect(inferLeagueClass("basketball_nba")).toBe("nba");
    expect(inferLeagueClass("basketball_nba", { stage: "semifinal" })).toBe("nba_playoffs");
    expect(inferLeagueClass("basketball_nba", { series: "nba_finals", stage: "final" })).toBe("nba_finals");
    expect(inferLeagueClass("icehockey_nhl")).toBe("nhl");
    expect(inferLeagueClass("icehockey_nhl", { stage: "quarterfinal" })).toBe("nhl_playoffs");
    expect(inferLeagueClass("icehockey_nhl", { series: "nhl_finals", stage: "final" })).toBe("nhl_finals");
    expect(inferLeagueClass("tennis_atp_wimbledon")).toBe("grand_slam");
    expect(inferLeagueClass("tennis_wta_wimbledon")).toBe("grand_slam");
    expect(inferLeagueClass("tennis_atp_paris_masters")).toBe("masters_1000");
    expect(inferLeagueClass("tennis_atp_500_halle")).toBe("atp_500");
    expect(inferLeagueClass("tennis_atp_halle")).toBe("atp_250");
    expect(inferLeagueClass("tennis_wta_indian_wells")).toBe("wta");
  });
});

describe("isDerby", () => {
  const pairs = [{ sportKey: "soccer_spain_la_liga", teamA: "Real Madrid", teamB: "Barcelona" }];

  it("matches a rivalry in either direction", () => {
    expect(isDerby("soccer_spain_la_liga", "Barcelona", "Real Madrid", pairs)).toBe(true);
    expect(isDerby("soccer_spain_la_liga", "real madrid", "barcelona", pairs)).toBe(true);
    expect(isDerby("soccer_uefa_champs_league", "Real Madrid", "Barcelona", pairs)).toBe(false);
    expect(isDerby("soccer_spain_la_liga", "Real Madrid", "Real Madrid", pairs)).toBe(false);
  });
});
