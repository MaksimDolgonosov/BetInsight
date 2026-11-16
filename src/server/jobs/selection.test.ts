import { describe, expect, it } from "vitest";
import { attachResearchScores, attachSelectionScores, planSelection, type SelectionEvent } from "./selection";

const NOW = new Date("2026-11-16T03:00:00.000Z");
const WINDOW = { minHours: 20, maxHours: 54 };

function scheduled(id: string, commenceTime: string, sportKey = "soccer_spain_la_liga", home = `${id} home`, away = `${id} away`): SelectionEvent {
  return {
    id,
    sportKey,
    home,
    away,
    commenceTime: new Date(commenceTime),
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

describe("planSelection", () => {
  it("scores form from earlier results and keeps only the windowed quota", () => {
    const selected = planSelection({
      now: NOW,
      window: WINDOW,
      dailyLimit: 8,
      quotas: { perLeague: 3, tennis: 2 },
      events: [
        scheduled("early", "2026-11-16T12:00:00.000Z"),
        scheduled("madrid", "2026-11-17T18:00:00.000Z"),
        ...[1, 2, 3, 4, 5].map((index) => ({
          id: `home-${index}`,
          sportKey: "soccer_spain_la_liga",
          home: "madrid home",
          away: "Other",
          commenceTime: new Date(`2026-10-${10 + index}T18:00:00.000Z`),
          status: "completed",
          homeScore: 2,
          awayScore: 0,
        })),
        ...[1, 2, 3, 4, 5].map((index) => ({
          id: `away-${index}`,
          sportKey: "soccer_spain_la_liga",
          home: "Rival",
          away: "madrid away",
          commenceTime: new Date(`2026-10-${10 + index}T16:00:00.000Z`),
          status: "completed",
          homeScore: 2,
          awayScore: 0,
        })),
        scheduled("late", "2026-11-20T18:00:00.000Z"),
        ...["a", "b", "c", "d"].map((id, index) => scheduled(id, `2026-11-17T${18 + index}:00:00.000Z`)),
      ],
    });

    const madrid = selected.find((event) => event.eventId === "madrid");
    expect(madrid).toMatchObject({ significanceScore: 30, formSource: "calculated", formBonus: 15, finalScore: 45 });
    expect(selected.map((event) => event.eventId)).not.toContain("early");
    expect(selected.map((event) => event.eventId)).not.toContain("late");
    expect(selected.filter((event) => event.sportKey === "soccer_spain_la_liga")).toHaveLength(3);
  });

  it("adds the cup-final bonus when the slate is a single match", () => {
    const selected = planSelection({
      now: NOW,
      window: WINDOW,
      dailyLimit: 8,
      quotas: { perLeague: 3, tennis: 2 },
      events: [scheduled("final", "2026-11-17T20:00:00.000Z", "soccer_uefa_champs_league")],
    });
    expect(selected[0]).toMatchObject({ significanceScore: 65, stage: "final", series: null, leagueClass: "ucl" });
  });

  it("scores two games of one NBA pair as the finals and leaves a one-game night in the regular season", () => {
    const finals = planSelection({
      now: NOW,
      window: WINDOW,
      dailyLimit: 8,
      quotas: { perLeague: 3, tennis: 2 },
      events: [
        scheduled("g1", "2026-11-17T02:00:00.000Z", "basketball_nba", "Boston Celtics", "Dallas Mavericks"),
        scheduled("g2", "2026-11-19T02:00:00.000Z", "basketball_nba", "Dallas Mavericks", "Boston Celtics"),
      ],
    });
    expect(finals.map((event) => event.eventId)).toEqual(["g1"]);
    expect(finals[0]).toMatchObject({ leagueClass: "nba_finals", stage: "final", significanceScore: 65 });

    const night = planSelection({
      now: NOW,
      window: WINDOW,
      dailyLimit: 8,
      quotas: { perLeague: 3, tennis: 2 },
      events: [scheduled("only", "2026-11-17T02:00:00.000Z", "basketball_nba", "Boston Celtics", "Dallas Mavericks")],
    });
    expect(night[0]).toMatchObject({ leagueClass: "nba", stage: null, significanceScore: 30 });
  });
});

describe("attachSelectionScores", () => {
  it("copies a stored score onto every new outcome of that event", () => {
    const rows = attachSelectionScores(
      [{ eventId: "madrid", market: "h2h" }, { eventId: "other", market: "h2h" }],
      [{
        eventId: "madrid",
        significanceScore: 30,
        formHome: 1,
        formAway: 0,
        formDelta: 1,
        formBonus: 15,
        finalScore: 45,
        formSource: "calculated",
        roundStage: "final",
      }],
    );
    expect(rows[0]).toMatchObject({ market: "h2h", finalScore: 45, formSource: "calculated", roundStage: "final" });
    expect(rows[1]).toEqual({ eventId: "other", market: "h2h" });
  });
});

describe("attachResearchScores", () => {
  it("keeps the research stamp when odds rows replace the selection placeholder", () => {
    const rows = attachResearchScores(
      [{ eventId: "madrid", market: "h2h" }],
      [{ eventId: "madrid", dataScore: 4, researchSummary: "Thin lineup news.", discardReason: null, lowConfidence: true }],
    );
    expect(rows[0]).toMatchObject({ market: "h2h", dataScore: 4, lowConfidence: true, researchSummary: "Thin lineup news." });
  });
});