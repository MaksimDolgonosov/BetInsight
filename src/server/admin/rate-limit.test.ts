import { describe, expect, it } from "vitest";
import { testRunAllowance } from "./rate-limit";

describe("test run allowance", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("allows the first run of the day", () => {
    expect(
      testRunAllowance({ now, lastRunAt: null, runsToday: 0, dailyLimit: 3 }),
    ).toEqual({ ok: true });
  });

  it("blocks a second run inside five minutes and after the daily cap", () => {
    expect(
      testRunAllowance({
        now,
        lastRunAt: "2026-03-10T11:57:00.000Z",
        runsToday: 1,
        dailyLimit: 3,
      }),
    ).toEqual({ ok: false, reason: "interval" });

    expect(
      testRunAllowance({
        now,
        lastRunAt: "2026-03-10T10:00:00.000Z",
        runsToday: 3,
        dailyLimit: 3,
      }),
    ).toEqual({ ok: false, reason: "daily" });
  });
});
