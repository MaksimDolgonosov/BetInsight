import { describe, expect, it } from "vitest";
import { deliveryFailure, shouldAlertAfterRetries } from "./policy";

describe("deliveryFailure", () => {
  it("treats 403 as a blocked subscriber", () => {
    expect(deliveryFailure(403)).toEqual({ blocked: true, retry: false });
  });

  it("retries rate limits and server errors", () => {
    expect(deliveryFailure(429)).toEqual({ blocked: false, retry: true });
    expect(deliveryFailure(500)).toEqual({ blocked: false, retry: true });
  });

  it("does not retry a rejected message", () => {
    expect(deliveryFailure(400)).toEqual({ blocked: false, retry: false });
  });
});

describe("shouldAlertAfterRetries", () => {
  it("alerts only after the last retry of a failed job", () => {
    expect(shouldAlertAfterRetries(500, 3)).toBe(true);
    expect(shouldAlertAfterRetries(500, 2)).toBe(false);
    expect(shouldAlertAfterRetries(400, 3)).toBe(false);
  });
});
