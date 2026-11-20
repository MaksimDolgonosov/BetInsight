import { describe, expect, it } from "vitest";
import { scheduledForecasts, type ScheduledSource } from "./scheduled";

const NOW = new Date("2026-11-20T05:00:00.000Z");

function row(patch: Partial<ScheduledSource> = {}): ScheduledSource {
  return {
    eventId: "match",
    home: "Home",
    away: "Away",
    sportKey: "basketball_nba",
    league: "NBA",
    commenceTime: new Date("2026-11-20T19:00:00.000Z"),
    voteTime: new Date("2026-11-20T17:00:00.000Z"),
    createdAt: new Date("2026-11-20T04:00:00.000Z"),
    asymmetryScore: 0.62,
    discardReason: null,
    ...patch,
  };
}

describe("scheduledForecasts", () => {
  it("lists a selected match with the stored forecast time", () => {
    const [match] = scheduledForecasts({ rows: [row()], publishedEventIds: new Set(), now: NOW });
    expect(match).toMatchObject({
      eventId: "match",
      home: "Home",
      voteTime: "2026-11-20T17:00:00.000Z",
    });
  });

  it("hides a match once a forecast is published, discarded, or the kickoff has passed", () => {
    const rows = [
      row({ eventId: "published" }),
      row({ eventId: "discarded", discardReason: "thin_data" }),
      row({ eventId: "started", commenceTime: new Date("2026-11-20T04:00:00.000Z") }),
      row({ eventId: "waiting", voteTime: null, commenceTime: new Date("2026-11-21T01:10:00.000Z") }),
    ];
    const visible = scheduledForecasts({ rows, publishedEventIds: new Set(["published"]), now: NOW });
    expect(visible.map((match) => match.eventId)).toEqual(["waiting"]);
    expect(visible[0]?.voteTime).toBe("2026-11-20T17:00:00.000Z");
  });
});
