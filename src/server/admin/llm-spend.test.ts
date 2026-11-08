import { describe, expect, it } from "vitest";
import { groupModelSpend } from "./llm-spend";

describe("groupModelSpend", () => {
  it("sums spend for every model that was used", () => {
    const rows = groupModelSpend([
      { model: "anthropic/claude-sonnet-5.5", costUsd: 0.1 },
      { model: "anthropic/claude-sonnet-5.5", costUsd: 0.05 },
      { model: "openai/gpt-6.1-terra", costUsd: 0.02 },
      { model: "google/gemini-3.8-flash", costUsd: null },
      { model: "perplexity/sonar", costUsd: 0.03 },
    ]);

    expect(rows.map((row) => row.model)).toEqual([
      "anthropic/claude-sonnet-5.5",
      "perplexity/sonar",
      "openai/gpt-6.1-terra",
      "google/gemini-3.8-flash",
    ]);
    expect(rows[0]?.costUsd).toBeCloseTo(0.15);
    expect(rows[3]?.costUsd).toBe(0);
  });
});
