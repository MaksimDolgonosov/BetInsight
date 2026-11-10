import { describe, expect, it } from "vitest";
import { calibrationBands, filterChoices, groupSlices, parseFilter, summarize, toCsv, withPeriod, type BaselineBet, type ModelVoteBet, type PublicPick } from "./metrics";

function pick(overrides: Partial<PublicPick>): PublicPick {
  return {
    id: "p1",
    eventId: "e1",
    track: "value",
    sportKey: "soccer_spain_la_liga",
    league: "La Liga",
    home: "Real Madrid",
    away: "Barcelona",
    market: "h2h",
    selection: "home",
    point: null,
    price: 2,
    bookmaker: "Pinnacle",
    status: "won",
    profitUnits: 1,
    aiProb: 0.55,
    confidence: "medium",
    llmModel: "anthropic/claude-sonnet-5.5",
    promptVersion: "v1",
    webSearch: false,
    publishedAt: "2026-11-01T12:00:00.000Z",
    settledAt: "2026-11-01T20:00:00.000Z",
    hash: "abc",
    matchesMarketFavorite: null,
    unanimous: null,
    closingPrice: 1.9,
    ...overrides,
  };
}

describe("public statistics", () => {
  const picks = [
    pick({}),
    pick({
      id: "p2",
      eventId: "e2",
      status: "lost",
      profitUnits: -1,
      price: 3,
      aiProb: 0.4,
      publishedAt: "2026-11-02T12:00:00.000Z",
      settledAt: "2026-11-02T20:00:00.000Z",
      closingPrice: null,
    }),
    pick({
      id: "p3",
      eventId: "e3",
      track: "ai_pick",
      status: "void",
      profitUnits: 0,
      aiProb: null,
      matchesMarketFavorite: true,
      unanimous: false,
      publishedAt: "2026-11-03T12:00:00.000Z",
      settledAt: "2026-11-03T20:00:00.000Z",
      closingPrice: null,
    }),
    pick({
      id: "p4",
      eventId: "e4",
      track: "ai_pick",
      status: "won",
      profitUnits: 0.5,
      price: 1.5,
      aiProb: 0.62,
      matchesMarketFavorite: false,
      unanimous: true,
      publishedAt: "2026-11-04T12:00:00.000Z",
      settledAt: "2026-11-04T20:00:00.000Z",
      closingPrice: 1.4,
    }),
  ];
  const baselines: BaselineBet[] = [
    { eventId: "e1", kind: "favorite", price: 1.5, probability: 0.6, status: "lost", profitUnits: -1, at: "2026-11-01T20:00:00.000Z" },
    { eventId: "e1", kind: "favorite", price: 9, probability: 0.1, status: "won", profitUnits: 8, at: "2026-11-01T20:00:00.000Z" },
    { eventId: "e2", kind: "model", price: 2.2, probability: 0.48, status: "won", profitUnits: 1.2, at: "2026-11-02T20:00:00.000Z" },
    { eventId: "other", kind: "favorite", price: 1.4, probability: 0.7, status: "won", profitUnits: 0.4, at: "2026-11-05T20:00:00.000Z" },
  ];
  const votes: ModelVoteBet[] = [
    { eventId: "e4", model: "openai/a", price: 1.5, probability: 0.6, status: "won", profitUnits: 0.5, at: "2026-11-04T20:00:00.000Z" },
    { eventId: "e4", model: "google/b", price: 1.5, probability: 0.4, status: "lost", profitUnits: -1, at: "2026-11-04T20:00:00.000Z" },
    { eventId: "e1", model: "openai/a", price: 2, probability: 0.5, status: "won", profitUnits: 1, at: "2026-11-01T20:00:00.000Z" },
  ];

  it("splits tracks, baselines and consensus without counting another event", () => {
    const summary = summarize({ picks, baselines, votes });
    expect(summary.combined).toMatchObject({ won: 2, lost: 1, void: 1, pending: 0, decided: 3, hitRate: 0.6667, profit: 0.5, smallSample: true });
    expect(summary.combined.roi).toBe(summary.combined.yield);
    expect(summary.combined.roi).toBeCloseTo(0.5 / 3);
    expect(summary.combined.clv).toBeCloseTo(((2 / 1.9 - 1) + (1.5 / 1.4 - 1)) / 2, 3);
    expect(summary.combined.maxDrawdown).toBe(1);
    expect(summary.combined.bank.map((point) => point.profit)).toEqual([1, 0, 0, 0.5]);
    expect(summary.value.decided).toBe(2);
    expect(summary.aiPick.won).toBe(1);
    expect(summary.favorite).toMatchObject({ count: 1, lost: 1, profit: -1 });
    expect(summary.model).toMatchObject({ count: 1, won: 1, profit: 1.2 });
    expect(summary.favoriteShare).toBe(0.5);
    expect(summary.unanimous.won).toBe(1);
    expect(summary.split.void).toBe(1);
    expect(summary.models.map((item) => item.model)).toEqual(["google/b", "openai/a"]);
    expect(summary.models[1]?.metrics).toMatchObject({ won: 1, lost: 0 });
    expect(summary.combined.hitRateLow).toBeLessThan(summary.combined.hitRate!);
    expect(summary.combined.hitRateHigh).toBeGreaterThan(summary.combined.hitRate!);
    expect(summary.combined.brier).not.toBeNull();
    expect(summary.combined.calibration.length).toBeGreaterThan(0);
  });

  it("filters a slice and exports the current rows", () => {
    const filter = parseFilter({ track: "ai_pick", from: "2026-11-04", league: ["soccer_spain_la_liga"] });
    const summary = summarize({ picks, baselines, votes, filter });
    expect(summary.rows.map((row) => row.id)).toEqual(["p4"]);
    expect(summary.favorite.count).toBe(0);
    const csv = toCsv(summary.rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("ai_pick");
    expect(csv).toContain("Real Madrid");
    expect(toCsv([pick({ home: "A, B", hash: "a\"b" })])).toContain("\"A, B\"");
    expect(toCsv([pick({ home: "A, B", hash: "a\"b" })])).toContain("\"a\"\"b\"");
  });

  it("ignores an unknown filter value", () => {
    expect(parseFilter({ track: "both", webSearch: "maybe", from: "tomorrow" })).toMatchObject({
      track: "all",
      webSearch: "all",
      from: null,
    });
  });

  it("offers leagues, markets and models before any forecast is published", () => {
    const choices = filterChoices({
      leagues: [
        { key: "soccer_spain_la_liga", title: "La Liga", enabled: true },
        { key: "basketball_nba", title: "NBA", enabled: false },
      ],
      models: ["openai/a", "google/b"],
      promptVersions: ["vote-v1"],
      picks: [],
    });
    expect(choices.leagues).toEqual([{ value: "soccer_spain_la_liga", label: "La Liga" }]);
    expect(choices.markets).toEqual(["h2h", "totals", "spreads"]);
    expect(choices.confidence).toEqual(["low", "medium", "high"]);
    expect(choices.models).toEqual(["google/b", "openai/a"]);
    expect(choices.prompts).toEqual(["vote-v1"]);
  });

  it("groups a slice and keeps the calibration axis before any result", () => {
    const rows = groupSlices(
      [
        pick({ id: "a", eventId: "e1", sportKey: "soccer_spain_la_liga", league: "La Liga", status: "won", profitUnits: 1 }),
        pick({ id: "b", eventId: "e2", sportKey: "basketball_nba", league: "NBA", status: "lost", profitUnits: -1 }),
      ],
      "league",
    );
    expect(rows.map((row) => row.label)).toEqual(["La Liga", "NBA"]);
    expect(calibrationBands([])).toHaveLength(6);
    expect(calibrationBands([])[0]).toMatchObject({ from: 0.4, count: 0 });
    expect(withPeriod({ period: "7" }, new Date("2026-11-09T00:00:00.000Z")).from).toBe("2026-11-02");
  });
});
