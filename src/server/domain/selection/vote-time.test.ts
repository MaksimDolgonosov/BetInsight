import { describe, expect, it } from "vitest";
import { voteTime } from "./vote-time";

const NOW = new Date("2026-11-16T03:00:00.000Z");

describe("voteTime", () => {
  it("uses two hours before kickoff when that instant is inside 08:00–20:00 MSK", () => {
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-16T14:00:00.000Z") }).toISOString()).toBe("2026-11-16T12:00:00.000Z");
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-16T18:00:00.000Z") }).toISOString()).toBe("2026-11-16T16:00:00.000Z");
  });

  it("clamps a late or next-day kickoff to 20:00 MSK on the plan day", () => {
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-16T20:00:00.000Z") }).toISOString()).toBe("2026-11-16T17:00:00.000Z");
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-17T00:00:00.000Z") }).toISOString()).toBe("2026-11-16T17:00:00.000Z");
  });

  it("keeps 08:00 MSK and keeps an earlier lead when 20:00 would be after kickoff", () => {
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-16T07:00:00.000Z") }).toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(voteTime({ now: NOW, commenceTime: new Date("2026-11-16T06:59:00.000Z") }).toISOString()).toBe("2026-11-16T04:59:00.000Z");
  });
});
