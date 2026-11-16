import { describe, expect, it } from "vitest";
import { parseRivalryInput, parseTeamMetaInput } from "./reference";

describe("parseTeamMetaInput", () => {
  it("stores a rank and uses the league key when the sport key is empty", () => {
    expect(parseTeamMetaInput({
      teamName: " Real Madrid ",
      sportKey: "",
      leagueKey: "soccer_spain_la_liga",
      tableRank: "1",
      relegation: false,
    })).toEqual({
      ok: true,
      row: {
        teamName: "Real Madrid",
        sportKey: "soccer_spain_la_liga",
        leagueKey: "soccer_spain_la_liga",
        tableRank: 1,
        isRelegation: false,
      },
    });
  });

  it("rejects a rank outside 1–40", () => {
    expect(parseTeamMetaInput({
      teamName: "Getafe",
      sportKey: "soccer_spain_la_liga",
      leagueKey: "soccer_spain_la_liga",
      tableRank: "0",
      relegation: true,
    })).toEqual({ ok: false, error: "invalid" });
  });
});

describe("parseRivalryInput", () => {
  it("stores the pair in one order", () => {
    const first = parseRivalryInput({
      sportKey: "soccer_spain_la_liga",
      teamA: "Real Madrid",
      teamB: "Barcelona",
      label: "El Clásico",
    });
    const second = parseRivalryInput({
      sportKey: "soccer_spain_la_liga",
      teamA: "Barcelona",
      teamB: "Real Madrid",
      label: "",
    });
    expect(first).toMatchObject({ ok: true, row: { teamA: "Barcelona", teamB: "Real Madrid", label: "El Clásico" } });
    expect(second).toMatchObject({ ok: true, row: { teamA: "Barcelona", teamB: "Real Madrid", label: null } });
  });
});