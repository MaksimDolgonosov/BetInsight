import { describe, expect, it } from "vitest";
import { fetchLeagueOdds } from "./client";
import { mapOddsEvents } from "./schema";

describe("odds api mapping", () => {
  it("maps home, draw, away and totals onto selections", () => {
    const { events, valid } = mapOddsEvents([
      {
        id: "evt",
        sport_key: "soccer_spain_la_liga",
        commence_time: "2026-03-10T18:00:00.000Z",
        home_team: "Barcelona",
        away_team: "Sevilla",
        bookmakers: [
          {
            key: "pinnacle",
            title: "Pinnacle",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Barcelona", price: 1.7 },
                  { name: "Draw", price: 3.8 },
                  { name: "Sevilla", price: 5 },
                ],
              },
              {
                key: "totals",
                outcomes: [
                  { name: "Over", price: 1.9, point: 2.5 },
                  { name: "Under", price: 1.95, point: 2.5 },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(valid).toBe(true);
    expect(events[0]?.quotes.map((quote) => quote.selection).sort()).toEqual([
      "away",
      "draw",
      "home",
      "over",
      "under",
    ]);
  });

  it("uses the preview mock and does not call the network", async () => {
    const previous = process.env.ODDS_API_MODE;
    process.env.ODDS_API_MODE = "mock";
    const result = await fetchLeagueOdds({
      sportKey: "soccer_spain_la_liga",
      region: "eu",
      markets: ["h2h"],
      fetchImpl: () => {
        throw new Error("network");
      },
    });
    process.env.ODDS_API_MODE = previous;

    expect(result.mocked).toBe(true);
    expect(result.events[0]?.quotes.every((quote) => quote.market === "h2h")).toBe(true);
  });
});
