import { describe, expect, it } from "vitest";
import { applyLeagueQuota } from "./quotas";
import { selectDay, type PricedEvent } from "./select";
import { inSelectionWindow } from "./window";

const NOW = new Date("2026-11-16T03:00:00.000Z");

function priced(overrides: Partial<PricedEvent> & Pick<PricedEvent, "eventId" | "commenceTime"> & { probability?: number }): PricedEvent {
  const probability = overrides.probability ?? 0.65;
  return {
    sportKey: "soccer_spain_la_liga",
    home: "Home",
    away: "Away",
    outcomes: [{ market: "h2h", selection: "home", point: null, probability }],
    ...overrides,
  };
}

describe("inSelectionWindow", () => {
  it("keeps commence times inside the inclusive 4–24 hour window", () => {
    const window = { minHours: 4, maxHours: 24 };
    expect(inSelectionWindow(new Date("2026-11-16T07:00:00.000Z"), NOW, window)).toBe(true);
    expect(inSelectionWindow(new Date("2026-11-17T03:00:00.000Z"), NOW, window)).toBe(true);
    expect(inSelectionWindow(new Date("2026-11-16T06:59:59.999Z"), NOW, window)).toBe(false);
    expect(inSelectionWindow(new Date("2026-11-17T03:00:00.001Z"), NOW, window)).toBe(false);
  });
});

describe("selectDay", () => {
  it("keeps the two matches closest to 65% in each league and drops the rest", () => {
    const inside = new Date("2026-11-16T14:00:00.000Z");
    const selected = selectDay({
      now: NOW,
      events: [
        priced({ eventId: "liga-64", commenceTime: inside, probability: 0.64 }),
        priced({ eventId: "liga-69", commenceTime: new Date("2026-11-16T15:00:00.000Z"), probability: 0.69 }),
        priced({ eventId: "liga-61", commenceTime: new Date("2026-11-16T16:00:00.000Z"), probability: 0.61 }),
        priced({ eventId: "obvious", commenceTime: inside, probability: 0.78 }),
        priced({ eventId: "even", commenceTime: inside, probability: 0.48 }),
        priced({ eventId: "early", commenceTime: new Date("2026-11-16T05:00:00.000Z"), probability: 0.65 }),
        priced({ eventId: "nba-65", sportKey: "basketball_nba", commenceTime: inside, probability: 0.65 }),
        priced({ eventId: "nba-70", sportKey: "basketball_nba", commenceTime: inside, probability: 0.7 }),
        priced({ eventId: "nba-60", sportKey: "basketball_nba", commenceTime: new Date("2026-11-16T18:00:00.000Z"), probability: 0.6 }),
      ],
    });

    expect(selected.map((event) => event.eventId)).toEqual(["nba-60", "liga-61", "liga-64", "nba-65"]);
    expect(selected.find((event) => event.eventId === "liga-64")).toMatchObject({
      asymmetryScore: 0.64,
      asymmetryMarket: "h2h",
      voteTime: new Date("2026-11-16T12:00:00.000Z"),
    });
  });
});

describe("applyLeagueQuota", () => {
  it("prefers the earlier kickoff when the asymmetry strength ties", () => {
    const selected = applyLeagueQuota(
      [
        candidate("b", 1, "2026-11-16T15:00:00.000Z"),
        candidate("a", 1, "2026-11-16T14:00:00.000Z"),
      ],
      1,
    );
    expect(selected.map((item) => item.eventId)).toEqual(["a"]);
  });
});

function candidate(eventId: string, strength: number, commenceTime: string) {
  return {
    eventId,
    leagueKey: "soccer_spain_la_liga",
    commenceTime: new Date(commenceTime),
    asymmetryStrength: strength,
  };
}
