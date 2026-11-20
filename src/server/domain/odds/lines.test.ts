import { describe, expect, it } from "vitest";
import { averageBookPrice, latestBefore, quoteTable } from "./lines";

describe("quoteTable", () => {
  it("shows the overround of a two-way line", () => {
    const table = quoteTable([
      { bookmaker: "Pinnacle", selection: "over", price: 1.88 },
      { bookmaker: "Pinnacle", selection: "under", price: 2.02 },
      { bookmaker: "Betfair", selection: "under", price: 1.97 },
      { bookmaker: "Betfair", selection: "over", price: 1.91 },
    ]);

    expect(table.selections).toEqual(["over", "under"]);
    expect(table.rows.map((row) => row.bookmaker)).toEqual(["Betfair", "Pinnacle"]);
    expect(table.rows[1]?.margin).toBeCloseTo(1 / 1.88 + 1 / 2.02 - 1, 6);
  });

  it("keeps the home, draw, away column order", () => {
    const table = quoteTable([
      { bookmaker: "Pinnacle", selection: "away", price: 3.4 },
      { bookmaker: "Pinnacle", selection: "home", price: 2.1 },
      { bookmaker: "Pinnacle", selection: "draw", price: 3.5 },
    ]);

    expect(table.selections).toEqual(["home", "draw", "away"]);
    expect(table.rows[0]?.margin).toBeCloseTo(1 / 2.1 + 1 / 3.5 + 1 / 3.4 - 1, 6);
  });

  it("averages one price per bookmaker and keeps the latest snapshot before a time", () => {
    expect(
      averageBookPrice([
        { bookmaker: "Pinnacle", selection: "home", price: 1.8 },
        { bookmaker: "Pinnacle", selection: "home", price: 1.9 },
        { bookmaker: "Betfair", selection: "home", price: 2.1 },
      ]),
    ).toBeCloseTo(2);

    const early = new Date("2026-11-20T04:00:00.000Z");
    const late = new Date("2026-11-20T07:00:00.000Z");
    const batch = latestBefore(
      [
        { fetchedAt: early, price: 1.5 },
        { fetchedAt: new Date(early.getTime() + 1000), price: 1.6 },
        { fetchedAt: late, price: 2 },
      ],
      new Date("2026-11-20T05:00:00.000Z"),
    );
    expect(batch.map((row) => row.price)).toEqual([1.5, 1.6]);
  });

  it("leaves the margin empty when a price is missing", () => {
    const table = quoteTable([{ bookmaker: "Pinnacle", selection: "over", price: 1.9 }]);
    expect(table.rows[0]?.margin).toBeNull();
  });
});
