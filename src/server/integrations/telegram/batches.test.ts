import { describe, expect, it } from "vitest";
import { chunk, planBatches } from "./batches";

describe("chunk", () => {
  it("splits recipients into groups of 25", () => {
    const groups = chunk(Array.from({ length: 26 }, (_, index) => index), 25);
    expect(groups.map((group) => group.length)).toEqual([25, 1]);
  });
});

describe("planBatches", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");

  it("sends the first batch now and delays the next one", () => {
    const plan = planBatches(
      Array.from({ length: 30 }, (_, id) => ({ id, notBefore: null })),
      25,
      now,
    );
    expect(plan.map((batch) => batch.items.length)).toEqual([25, 5]);
    expect(plan[0]?.notBefore).toBeNull();
    expect(plan[1]?.notBefore?.toISOString()).toBe("2026-11-09T12:00:20.000Z");
  });

  it("keeps quiet-hour recipients in their own batch", () => {
    const quiet = new Date("2026-11-10T05:00:30.000Z");
    const plan = planBatches(
      [
        { id: "now", notBefore: null },
        { id: "later", notBefore: quiet },
      ],
      25,
      now,
    );
    expect(plan[0]?.items.map((item) => item.id)).toEqual(["now"]);
    expect(plan[1]?.items.map((item) => item.id)).toEqual(["later"]);
    expect(plan[1]?.notBefore?.toISOString()).toBe("2026-11-10T05:00:00.000Z");
  });
});
