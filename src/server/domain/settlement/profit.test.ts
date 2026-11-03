import { describe, expect, it } from "vitest";
import { decideSettlement, profitUnits } from "./profit";

describe("settlement", () => {
  const now = new Date("2026-03-10T18:00:00.000Z");
  const event = {
    missingFromScores: true,
    commenceTime: "2026-03-10T15:00:00.000Z",
  };

  it("pays the decimal price minus the stake, and loses one unit", () => {
    expect(profitUnits("won", 2.4)).toBeCloseTo(1.4);
    expect(profitUnits("lost", 2.4)).toBe(-1);
    expect(profitUnits("void", 2.4)).toBe(0);
  });

  it("settles only a pending pick for an event that scores did not return", () => {
    const result = decideSettlement({
      prediction: { status: "pending", price: 2.4 },
      event,
      nextStatus: "won",
      comment: "Нет в /scores, счёт 2:1 по протоколу.",
      now,
    });
    expect(result).toEqual({
      ok: true,
      profitUnits: 1.4,
      comment: "Нет в /scores, счёт 2:1 по протоколу.",
    });
  });

  it("rejects events that can still be settled from the scores feed", () => {
    const result = decideSettlement({
      prediction: { status: "pending", price: 2.4 },
      event: { ...event, missingFromScores: false },
      nextStatus: "lost",
      comment: "Комментарий достаточной длины",
      now,
    });
    expect(result).toEqual({ ok: false, error: "not_eligible" });
  });

  it("requires a comment and refuses a match that has not started", () => {
    expect(
      decideSettlement({
        prediction: { status: "pending", price: 1.8 },
        event,
        nextStatus: "void",
        comment: "коротко",
        now,
      }),
    ).toEqual({ ok: false, error: "comment" });

    expect(
      decideSettlement({
        prediction: { status: "pending", price: 1.8 },
        event: { ...event, commenceTime: "2026-03-10T20:00:00.000Z" },
        nextStatus: "void",
        comment: "Матч ещё не начался, комментарий есть",
        now,
      }),
    ).toEqual({ ok: false, error: "not_started" });
  });
});
