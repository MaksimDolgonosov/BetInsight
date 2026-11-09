import { describe, expect, it } from "vitest";
import { dayKey, onCalendarDay, quietUntil, shiftDay } from "./quiet";

describe("quietUntil", () => {
  const window = { start: "23:00", end: "08:00" };

  it("waits until quiet hours end after midnight in Moscow", () => {
    expect(quietUntil(new Date("2026-11-09T20:30:00.000Z"), window, "Europe/Moscow")?.toISOString()).toBe(
      "2026-11-10T05:00:00.000Z",
    );
    expect(quietUntil(new Date("2026-11-09T22:30:00.000Z"), window, "Europe/Moscow")?.toISOString()).toBe(
      "2026-11-10T05:00:00.000Z",
    );
  });

  it("sends immediately outside the window", () => {
    expect(quietUntil(new Date("2026-11-09T19:00:00.000Z"), window, "Europe/Moscow")).toBeNull();
    expect(quietUntil(new Date("2026-11-09T12:00:00.000Z"), null, "Europe/Moscow")).toBeNull();
  });

  it("uses a same-day window", () => {
    expect(
      quietUntil(new Date("2026-11-09T09:00:00.000Z"), { start: "09:00", end: "18:00" }, "Europe/Moscow")?.toISOString(),
    ).toBe("2026-11-09T15:00:00.000Z");
  });
});

describe("calendar days", () => {
  it("keys a moment in Moscow and shifts the date", () => {
    expect(dayKey(new Date("2026-11-09T22:30:00.000Z"), "Europe/Moscow")).toBe("2026-11-10");
    expect(shiftDay("2026-11-09", -6)).toBe("2026-11-03");
    expect(onCalendarDay("2026-11-09T22:30:00.000Z", "2026-11-10", "2026-11-10", "Europe/Moscow")).toBe(true);
  });
});
