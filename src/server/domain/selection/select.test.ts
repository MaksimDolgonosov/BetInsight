import { describe, expect, it } from "vitest";
import { applyDailyQuotas } from "./quotas";
import { scoreEvent, selectDay, type ScheduleEvent } from "./select";
import { inSelectionWindow } from "./window";

const NOW = new Date("2026-11-16T03:00:00.000Z");

function event(overrides: Partial<ScheduleEvent> & Pick<ScheduleEvent, "eventId" | "sportKey" | "commenceTime">): ScheduleEvent {
  return {
    home: "Home",
    away: "Away",
    homeForm: ["W", "W", "W", "W", "W"],
    awayForm: ["L", "L", "L", "L", "L"],
    ...overrides,
  };
}

describe("inSelectionWindow", () => {
  it("keeps commence times inside the inclusive 20–54 hour window", () => {
    const window = { minHours: 20, maxHours: 54 };
    expect(inSelectionWindow(new Date("2026-11-16T23:00:00.000Z"), NOW, window)).toBe(true);
    expect(inSelectionWindow(new Date("2026-11-18T09:00:00.000Z"), NOW, window)).toBe(true);
    expect(inSelectionWindow(new Date("2026-11-16T22:59:59.999Z"), NOW, window)).toBe(false);
    expect(inSelectionWindow(new Date("2026-11-18T09:00:00.001Z"), NOW, window)).toBe(false);
  });
});

describe("scoreEvent", () => {
  it("adds a derby and top-four bonus from team meta", () => {
    const scored = scoreEvent(
      event({
        eventId: "clasico",
        sportKey: "soccer_spain_la_liga",
        home: "Real Madrid",
        away: "Barcelona",
        commenceTime: new Date("2026-11-17T20:00:00.000Z"),
        homeForm: ["W", "D", "L"],
        awayForm: ["L", "L", "L"],
      }),
      [
        { teamName: "Real Madrid", sportKey: "soccer_spain_la_liga", leagueKey: "soccer_spain_la_liga", tableRank: 1, isRelegation: false },
        { teamName: "Barcelona", sportKey: "soccer_spain_la_liga", leagueKey: "soccer_spain_la_liga", tableRank: 2, isRelegation: false },
      ],
      [{ sportKey: "soccer_spain_la_liga", teamA: "Real Madrid", teamB: "Barcelona" }],
    );

    expect(scored.leagueClass).toBe("la_liga");
    expect(scored.isDerby).toBe(true);
    expect(scored.significanceScore).toBe(65);
    expect(scored.formBonus).toBe(7);
    expect(scored.finalScore).toBe(72);
    expect(scored.formSource).toBe("calculated");
  });
});

describe("selectDay", () => {
  it("drops events outside the window and fills the day under league and tennis quotas", () => {
    const inside = new Date("2026-11-17T18:00:00.000Z");
    const later = new Date("2026-11-17T20:00:00.000Z");
    const tooSoon = new Date("2026-11-16T12:00:00.000Z");
    const selected = selectDay({
      now: NOW,
      window: { minHours: 20, maxHours: 54 },
      dailyLimit: 8,
      quotas: { perLeague: 3, tennis: 2 },
      events: [
        event({ eventId: "liga-1", sportKey: "soccer_spain_la_liga", commenceTime: inside }),
        event({ eventId: "liga-2", sportKey: "soccer_spain_la_liga", commenceTime: later }),
        event({ eventId: "liga-3", sportKey: "soccer_spain_la_liga", commenceTime: later }),
        event({ eventId: "liga-4", sportKey: "soccer_spain_la_liga", commenceTime: later, homeForm: ["L", "L", "L"], awayForm: ["L", "L", "L"] }),
        event({ eventId: "early", sportKey: "soccer_uefa_champs_league", commenceTime: tooSoon, stage: "final" }),
        event({ eventId: "ucl", sportKey: "soccer_uefa_champs_league", commenceTime: inside, stage: "quarterfinal", homeForm: [], awayForm: [] }),
        event({ eventId: "tennis-1", sportKey: "tennis_atp_wimbledon", commenceTime: inside, homeForm: [], awayForm: [] }),
        event({ eventId: "tennis-2", sportKey: "tennis_atp_paris_masters", commenceTime: later, homeForm: [], awayForm: [] }),
        event({ eventId: "tennis-3", sportKey: "tennis_wta_rome", commenceTime: later, homeForm: [], awayForm: [] }),
      ],
    });

    expect(selected.map((item) => item.eventId)).toEqual(["ucl", "liga-1", "liga-2", "liga-3", "tennis-1", "tennis-2"]);
    expect(selected.find((item) => item.eventId === "ucl")?.formSource).toBe("insufficient_data");
    expect(selected.find((item) => item.eventId === "ucl")?.finalScore).toBe(55);
  });
});

describe("applyDailyQuotas", () => {
  it("prefers the earlier kickoff when scores tie", () => {
    const selected = applyDailyQuotas(
      [
        candidate("b", 40, "2026-11-17T20:00:00.000Z"),
        candidate("a", 40, "2026-11-17T18:00:00.000Z"),
      ],
      { dailyLimit: 1, quotas: { perLeague: 3, tennis: 2 } },
    );
    expect(selected.map((item) => item.eventId)).toEqual(["a"]);
  });
});

function candidate(eventId: string, score: number, commenceTime: string) {
  return {
    eventId,
    sportKey: "soccer_spain_la_liga",
    leagueKey: "soccer_spain_la_liga",
    commenceTime: new Date(commenceTime),
    significanceScore: score,
    finalScore: score,
  };
}
