import { describe, expect, it } from "vitest";
import { budgetSnapshot, canSpend, creditsByDay } from "./budget";

const march = new Date("2026-03-10T12:00:00.000Z");

describe("budget", () => {
  it("projects the month-end balance from the average daily spend", () => {
    const snapshot = budgetSnapshot({
      monthlyLimit: 500,
      reserveCredits: 50,
      used: 100,
      now: march,
    });

    expect(snapshot.remaining).toBe(400);
    expect(snapshot.daysLeft).toBe(22);
    expect(snapshot.dailyLimit).toBeCloseTo(400 / 22);
    expect(snapshot.projectedRemaining).toBeCloseTo(400 - 10 * 21);
  });

  it("blocks a paid request that would enter the reserve, and lets scores use it", () => {
    const snapshot = { remaining: 60, reserveCredits: 50 };
    expect(canSpend(snapshot, 20, "other")).toEqual({ ok: false, reason: "reserve" });
    expect(canSpend(snapshot, 20, "scores")).toEqual({ ok: true });
    expect(canSpend(snapshot, 70, "scores")).toEqual({ ok: false, reason: "insufficient" });
  });

  it("sums credits by UTC day and ignores other months", () => {
    const series = creditsByDay(
      [
        { createdAt: "2026-03-01T01:00:00.000Z", cost: 2 },
        { createdAt: "2026-03-01T22:00:00.000Z", cost: 2 },
        { createdAt: "2026-02-28T23:00:00.000Z", cost: 9 },
      ],
      new Date("2026-03-02T00:00:00.000Z"),
    );

    expect(series).toEqual([
      { day: "01", credits: 4 },
      { day: "02", credits: 0 },
    ]);
  });
});
