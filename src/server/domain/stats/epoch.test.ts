import { describe, expect, it } from "vitest";
import { countEpoch, inStatsEpoch } from "./epoch";

describe("inStatsEpoch", () => {
  it("includes every dated row before the first reset", () => {
    expect(inStatsEpoch("2026-11-01T00:00:00.000Z", null)).toBe(true);
    expect(inStatsEpoch(null, null)).toBe(false);
  });

  it("keeps only rows at or after the reset", () => {
    const epoch = "2026-11-06T07:00:00.000Z";
    expect(inStatsEpoch("2026-11-06T07:00:00.000Z", epoch)).toBe(true);
    expect(inStatsEpoch("2026-11-06T08:00:00.000Z", epoch)).toBe(true);
    expect(inStatsEpoch("2026-11-06T06:59:59.000Z", epoch)).toBe(false);
  });
});

describe("countEpoch", () => {
  it("splits published predictions and ignores unpublished ones", () => {
    const epoch = "2026-11-06T07:00:00.000Z";
    expect(
      countEpoch(["2026-11-01T00:00:00.000Z", "2026-11-06T09:00:00.000Z", null], epoch),
    ).toEqual({ included: 1, archived: 1 });
  });
});