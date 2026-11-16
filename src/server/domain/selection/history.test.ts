import { describe, expect, it } from "vitest";
import { teamForm, type FinishedMatch } from "./history";

const before = new Date("2026-11-17T18:00:00.000Z");

function match(overrides: Partial<FinishedMatch> & Pick<FinishedMatch, "id" | "commenceTime" | "homeScore" | "awayScore">): FinishedMatch {
  return {
    sportKey: "soccer_spain_la_liga",
    home: "Real Madrid",
    away: "Getafe",
    ...overrides,
  };
}

describe("teamForm", () => {
  it("reads the five newest results for the team in that league", () => {
    const results = teamForm("Real Madrid", "soccer_spain_la_liga", [
      match({ id: "old", commenceTime: new Date("2026-08-01T18:00:00.000Z"), homeScore: 0, awayScore: 1 }),
      match({ id: "draw", commenceTime: new Date("2026-11-01T18:00:00.000Z"), home: "Sevilla", away: "Real Madrid", homeScore: 1, awayScore: 1 }),
      match({ id: "loss", commenceTime: new Date("2026-11-05T18:00:00.000Z"), homeScore: 0, awayScore: 2 }),
      match({ id: "win", commenceTime: new Date("2026-11-10T18:00:00.000Z"), homeScore: 3, awayScore: 0 }),
      match({ id: "other-league", sportKey: "soccer_uefa_champs_league", commenceTime: new Date("2026-11-12T18:00:00.000Z"), homeScore: 1, awayScore: 0 }),
      match({ id: "after", commenceTime: new Date("2026-11-18T18:00:00.000Z"), homeScore: 4, awayScore: 0 }),
      match({ id: "away-win", commenceTime: new Date("2026-10-20T18:00:00.000Z"), home: "Betis", away: "real madrid", homeScore: 0, awayScore: 1 }),
      match({ id: "sixth", commenceTime: new Date("2026-09-01T18:00:00.000Z"), homeScore: 2, awayScore: 0 }),
    ], before);

    expect(results).toEqual(["W", "L", "D", "W", "W"]);
  });
});