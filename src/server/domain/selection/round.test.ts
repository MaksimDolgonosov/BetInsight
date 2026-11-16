import { describe, expect, it } from "vitest";
import { inferRounds, type RoundFixture } from "./round";

function match(id: string, sportKey: string, commenceTime: string, home = `${id} home`, away = `${id} away`): RoundFixture {
  return { eventId: id, sportKey, home, away, commenceTime: new Date(commenceTime) };
}

function stage(id: string, fixtures: readonly RoundFixture[]) {
  return inferRounds(fixtures).get(id);
}

describe("inferRounds", () => {
  it("leaves a league match without a stage", () => {
    expect(stage("liga", [match("liga", "soccer_spain_la_liga", "2026-11-17T20:00:00.000Z")])).toEqual({ stage: null, series: null });
  });

  it("reads a cup round from one tightly spaced slate", () => {
    const day = "2026-11-17T20:00:00.000Z";
    const next = "2026-11-18T20:00:00.000Z";
    expect(stage("only", [match("only", "soccer_uefa_champs_league", day)])).toEqual({ stage: "final", series: null });
    expect(stage("a", [match("a", "soccer_uefa_champs_league", day), match("b", "soccer_uefa_champs_league", next)])?.stage).toBe("semifinal");

    const quarters = [0, 1, 2, 3].map((index) => match(`q${index}`, "soccer_uefa_champs_league", `2026-11-17T${18 + index}:00:00.000Z`));
    expect(stage("q0", quarters)?.stage).toBe("quarterfinal");

    const last16 = Array.from({ length: 8 }, (_, index) => match(
      `r${index}`,
      "soccer_uefa_champs_league",
      `2026-11-1${index < 4 ? 7 : 8}T${18 + (index % 4)}:00:00.000Z`,
    ));
    expect(stage("r0", last16)?.stage).toBe("round_of_16");

    const leaguePhase = Array.from({ length: 9 }, (_, index) => match(`l${index}`, "soccer_uefa_champs_league", `2026-11-17T${10 + index}:00:00.000Z`));
    expect(stage("l0", leaguePhase)?.stage).toBeNull();
  });

  it("does not call a lone cup match the final when another match is already on the board", () => {
    const fixtures = [
      match("now", "soccer_uefa_champs_league", "2026-11-17T20:00:00.000Z"),
      match("later", "soccer_uefa_champs_league", "2026-11-25T20:00:00.000Z"),
    ];
    expect(stage("now", fixtures)).toEqual({ stage: null, series: null });
  });

  it("marks a tennis final and leaves an early round unscored", () => {
    expect(stage("final", [match("final", "tennis_atp_wimbledon", "2026-07-12T13:00:00.000Z")])?.stage).toBe("final");
    const early = Array.from({ length: 16 }, (_, index) => match(`m${index}`, "tennis_atp_wimbledon", `2026-07-01T${String(8 + (index % 10)).padStart(2, "0")}:00:00.000Z`));
    expect(stage("m0", early)?.stage).toBeNull();
  });

  it("reads the Euroleague final four and ignores a series game that has a neighbour", () => {
    const four = [
      match("semi-1", "basketball_euroleague", "2026-05-23T16:00:00.000Z", "Real Madrid", "Olympiacos"),
      match("semi-2", "basketball_euroleague", "2026-05-23T19:00:00.000Z", "Barcelona", "Fenerbahce"),
      match("final", "basketball_euroleague", "2026-05-24T18:00:00.000Z", "Real Madrid", "Barcelona"),
    ];
    expect(stage("semi-1", four)).toEqual({ stage: "semifinal", series: null });
    expect(stage("final", four)).toEqual({ stage: "final", series: "euroleague_final" });

    const series = [
      match("g1", "basketball_euroleague", "2026-04-21T18:00:00.000Z"),
      match("g2", "basketball_euroleague", "2026-04-24T18:00:00.000Z"),
    ];
    expect(stage("g1", series)).toEqual({ stage: null, series: null });
  });

  it("calls two games of one NBA pair the finals and ignores a regular-season board", () => {
    const finals = [
      match("g1", "basketball_nba", "2026-06-04T00:00:00.000Z", "Boston Celtics", "Dallas Mavericks"),
      match("g2", "basketball_nba", "2026-06-07T00:00:00.000Z", "Dallas Mavericks", "Boston Celtics"),
    ];
    expect(stage("g1", finals)).toEqual({ stage: "final", series: "nba_finals" });
    expect(stage("only", [match("only", "basketball_nba", "2026-01-08T00:00:00.000Z", "Boston Celtics", "Dallas Mavericks")])).toEqual({ stage: null, series: null });

    const week = Array.from({ length: 12 }, (_, index) => match(
      `n${index}`,
      "basketball_nba",
      `2026-01-${10 + (index % 5)}T${String(index % 9).padStart(2, "0")}:00:00.000Z`,
      `Home ${index}`,
      `Away ${index}`,
    ));
    expect(stage("n0", week)).toEqual({ stage: null, series: null });
  });

  it("marks a four-team NHL board across several days as a semifinal", () => {
    const fixtures = [
      match("a", "icehockey_nhl", "2026-05-20T00:00:00.000Z", "Rangers", "Panthers"),
      match("b", "icehockey_nhl", "2026-05-22T00:00:00.000Z", "Oilers", "Stars"),
      match("c", "icehockey_nhl", "2026-05-24T00:00:00.000Z", "Panthers", "Rangers"),
    ];
    expect(stage("a", fixtures)).toEqual({ stage: "semifinal", series: null });
  });

  it("does not call a one-night NHL slate a playoff round", () => {
    const fixtures = [
      match("a", "icehockey_nhl", "2026-05-20T00:00:00.000Z", "Rangers", "Panthers"),
      match("b", "icehockey_nhl", "2026-05-20T23:00:00.000Z", "Oilers", "Stars"),
    ];
    expect(stage("a", fixtures)).toEqual({ stage: null, series: null });
  });
});
