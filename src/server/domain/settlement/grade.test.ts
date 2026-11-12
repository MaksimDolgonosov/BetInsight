import { describe, expect, it } from "vitest";
import { gradePrediction, settlementsFor } from "./grade";

const base = {
  eventStatus: "completed",
  market: "h2h",
  selection: "home",
  point: null,
  price: 2.4,
  homeScore: 2,
  awayScore: 1,
};

describe("automatic settlement", () => {
  it("grades a football result, including a draw", () => {
    expect(gradePrediction({ ...base, sportKey: "soccer_spain_la_liga" })).toMatchObject({ action: "settle", status: "won", profitUnits: 1.4 });
    expect(gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", selection: "away" })).toMatchObject({ status: "lost", profitUnits: -1 });
    expect(gradePrediction({ ...base, sportKey: "soccer_uefa_champs_league", homeScore: 1, awayScore: 1, selection: "draw" })).toMatchObject({
      status: "won",
      profitUnits: 1.4,
    });
    expect(gradePrediction({ ...base, sportKey: "soccer_germany_bundesliga", homeScore: 1, awayScore: 1, selection: "home" })).toMatchObject({
      status: "lost",
    });
  });

  it("settles basketball and NBA from the final score, which already includes overtime", () => {
    expect(gradePrediction({ ...base, sportKey: "basketball_euroleague", homeScore: 88, awayScore: 84, price: 1.9 })).toMatchObject({
      status: "won",
      profitUnits: 0.9,
    });
    expect(gradePrediction({ ...base, sportKey: "basketball_nba", homeScore: 118, awayScore: 115, selection: "away", price: 2.1 })).toMatchObject({
      status: "lost",
      profitUnits: -1,
    });
    expect(gradePrediction({ ...base, sportKey: "basketball_nba", selection: "draw", homeScore: 118, awayScore: 115 })).toMatchObject({
      status: "void",
      profitUnits: 0,
    });
    expect(gradePrediction({ ...base, sportKey: "basketball_euroleague", homeScore: 90, awayScore: 90 })).toMatchObject({ status: "void" });
  });

  it("settles an NHL final, including overtime, and voids a draw", () => {
    expect(gradePrediction({ ...base, sportKey: "icehockey_nhl", homeScore: 3, awayScore: 2, price: 1.8 })).toMatchObject({
      status: "won",
      profitUnits: 0.8,
    });
    expect(
      gradePrediction({
        ...base,
        sportKey: "icehockey_nhl",
        market: "totals",
        selection: "over",
        point: 5.5,
        homeScore: 3,
        awayScore: 2,
      }),
    ).toMatchObject({ status: "lost" });
    expect(
      gradePrediction({
        ...base,
        sportKey: "icehockey_nhl",
        market: "spreads",
        selection: "away",
        point: 1.5,
        price: 1.9,
        homeScore: 3,
        awayScore: 2,
      }),
    ).toMatchObject({ status: "won", profitUnits: 0.9 });
    expect(gradePrediction({ ...base, sportKey: "icehockey_nhl", homeScore: 2, awayScore: 2 })).toMatchObject({ status: "void" });
  });

  it("does not treat a 2:1 basketball feed as a finished score", () => {
    expect(gradePrediction({ ...base, sportKey: "basketball_nba", homeScore: 2, awayScore: 1 })).toEqual({
      action: "wait",
      reason: "incomplete",
    });
  });

  it("settles tennis as two players with no draw, and waits when the total is still in sets", () => {
    expect(gradePrediction({ ...base, sportKey: "tennis_atp_paris", homeScore: 2, awayScore: 0 })).toMatchObject({ status: "won" });
    expect(gradePrediction({ ...base, sportKey: "tennis_wta_wimbledon", homeScore: 1, awayScore: 2, selection: "home" })).toMatchObject({
      status: "lost",
    });
    expect(gradePrediction({ ...base, sportKey: "tennis_atp_paris", selection: "draw", homeScore: 2, awayScore: 1 })).toMatchObject({
      status: "void",
    });
    expect(gradePrediction({ ...base, sportKey: "tennis_atp_paris", homeScore: 1, awayScore: 1 })).toMatchObject({ status: "void" });
    expect(
      gradePrediction({
        ...base,
        sportKey: "tennis_atp_paris",
        market: "totals",
        selection: "over",
        point: 22.5,
        homeScore: 2,
        awayScore: 1,
      }),
    ).toEqual({ action: "wait", reason: "incomplete" });
    expect(
      gradePrediction({
        ...base,
        sportKey: "tennis_atp_paris",
        market: "totals",
        selection: "over",
        point: 21.5,
        homeScore: 12,
        awayScore: 10,
      }),
    ).toMatchObject({ status: "won", profitUnits: 1.4 });
  });

  it("settles totals, including a push, and voids a cancelled match", () => {
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "totals", selection: "over", point: 2.5 }),
    ).toMatchObject({ status: "won" });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "totals", selection: "under", point: 2.5 }),
    ).toMatchObject({ status: "lost" });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "totals", selection: "over", point: 3, homeScore: 2, awayScore: 1 }),
    ).toMatchObject({ status: "void", profitUnits: 0 });
    expect(gradePrediction({ ...base, sportKey: "basketball_nba", eventStatus: "void", homeScore: null, awayScore: null })).toMatchObject({
      status: "void",
      profitUnits: 0,
    });
  });

  it("settles handicaps, including a push and a split quarter line", () => {
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "home", point: -1.5, price: 1.9, homeScore: 2, awayScore: 0 }),
    ).toMatchObject({ status: "won", profitUnits: 0.9 });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "away", point: 1.5, price: 1.9, homeScore: 2, awayScore: 0 }),
    ).toMatchObject({ status: "lost", profitUnits: -1 });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "home", point: -1, homeScore: 2, awayScore: 1 }),
    ).toMatchObject({ status: "void", profitUnits: 0 });
    expect(
      gradePrediction({ ...base, sportKey: "basketball_nba", market: "spreads", selection: "home", point: 0, price: 1.91, homeScore: 110, awayScore: 110 }),
    ).toMatchObject({ status: "void", profitUnits: 0 });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "home", point: 0.25, price: 1.8, homeScore: 1, awayScore: 1 }),
    ).toMatchObject({ status: "won", profitUnits: 0.4 });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "home", point: -0.75, price: 1.9, homeScore: 2, awayScore: 1 }),
    ).toMatchObject({ status: "won", profitUnits: 0.45 });
    expect(
      gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", market: "spreads", selection: "home", point: -0.25, price: 1.9, homeScore: 1, awayScore: 1 }),
    ).toMatchObject({ status: "lost", profitUnits: -0.5 });
    expect(
      gradePrediction({ ...base, sportKey: "tennis_atp_paris", market: "spreads", selection: "home", point: -3.5, homeScore: 2, awayScore: 1 }),
    ).toEqual({ action: "wait", reason: "incomplete" });
    expect(
      gradePrediction({ ...base, sportKey: "tennis_atp_paris", market: "spreads", selection: "home", point: -3.5, price: 1.8, homeScore: 12, awayScore: 8 }),
    ).toMatchObject({ status: "won", profitUnits: 0.8 });
  });

  it("waits for a match that has not finished", () => {
    expect(gradePrediction({ ...base, sportKey: "soccer_spain_la_liga", eventStatus: "live", homeScore: null, awayScore: null })).toEqual({
      action: "wait",
      reason: "incomplete",
    });
  });

  it("returns only rows that can be written", () => {
    const rows = settlementsFor([
      { id: "ready", ...base, sportKey: "soccer_spain_la_liga" },
      { id: "later", ...base, sportKey: "soccer_spain_la_liga", eventStatus: "scheduled", homeScore: null, awayScore: null },
    ]);
    expect(rows).toEqual([{ id: "ready", status: "won", profitUnits: 1.4 }]);
  });
});
