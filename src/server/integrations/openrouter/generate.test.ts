import { describe, expect, it } from "vitest";
import { generatePrediction } from "./generate";

describe("generatePrediction", () => {
  it("retries once when the first response fails schema validation", async () => {
    const calls: string[] = [];
    const valid = JSON.stringify({
      pick: { market: "h2h", selection: "home", point: null },
      ai_probability: 0.54,
      confidence: "medium",
      reasoning: { ru: "Линия завышена.", en: "The line is short." },
      skip: false,
    });

    const result = await generatePrediction(
      {
        model: "anthropic/claude-sonnet-5.5",
        promptVersion: "v1",
        webSearch: false,
        payload: { event: "test" },
      },
      async () => {
        calls.push("send");
        if (calls.length === 1) {
          return { content: "{\"skip\":", model: "anthropic/claude-sonnet-5.5", tokensIn: 10, tokensOut: 2, costUsd: 0.001 };
        }
        return { content: valid, model: "anthropic/claude-sonnet-5.5", tokensIn: 10, tokensOut: 20, costUsd: 0.002 };
      },
    );

    expect(calls).toHaveLength(2);
    expect(result.parsed?.pick.selection).toBe("home");
    expect(result.validationError).toBeNull();
    expect(result.costUsd).toBeCloseTo(0.003);
    expect(result.tokensIn).toBe(20);
  });

  it("keeps the validation error when both attempts are invalid", async () => {
    const result = await generatePrediction(
      {
        model: "anthropic/claude-sonnet-5.5",
        promptVersion: "v1",
        webSearch: false,
        payload: {},
      },
      async () => ({ content: "{}", model: "test", tokensIn: 1, tokensOut: 1, costUsd: null }),
    );

    expect(result.parsed).toBeNull();
    expect(result.validationError).toBeTruthy();
  });
});
