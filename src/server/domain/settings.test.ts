import { describe, expect, it } from "vitest";
import { defaultSettings, parseSettingsForm } from "./settings";

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) data.append(key, item);
    } else {
      data.set(key, value);
    }
  }
  return data;
}

function validEntries(overrides: Record<string, string | string[]> = {}) {
  return {
    league: [
      "soccer_spain_la_liga",
      "soccer_germany_bundesliga",
      "soccer_uefa_champs_league",
      "basketball_euroleague",
    ],
    market: ["h2h", "totals"],
    region: "eu",
    llmModel: "anthropic/claude-sonnet-5.5",
    promptVersion: "v1",
    monthlyCreditLimit: "500",
    reserveCredits: "50",
    testRunsPerDay: "3",
    "soccer.evPercent": "2",
    "soccer.oddsMin": "1.5",
    "soccer.oddsMax": "4",
    "soccer.minBookmakers": "3",
    "soccer.totalsPointMin": "0.5",
    "soccer.totalsPointMax": "5.5",
    "basketball.evPercent": "2",
    "basketball.oddsMin": "1.5",
    "basketball.oddsMax": "4",
    "basketball.minBookmakers": "3",
    "basketball.totalsPointMin": "140",
    "basketball.totalsPointMax": "190",
    ...overrides,
  };
}

describe("parseSettingsForm", () => {
  it("keeps the four default leagues and converts the EV percent", () => {
    const result = parseSettingsForm(form(validEntries()), defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.thresholds.soccer.evThreshold).toBeCloseTo(0.02);
    expect(result.settings.leagues).toHaveLength(4);
    expect(result.settings.webSearchEnabled).toBe(false);
  });

  it("rejects a reserve that consumes the whole month", () => {
    const result = parseSettingsForm(
      form(validEntries({ reserveCredits: "500" })),
      defaultSettings(),
    );
    expect(result).toEqual({ ok: false, error: "reserve" });
  });

  it("rejects a free OpenRouter model", () => {
    const result = parseSettingsForm(
      form(validEntries({ llmModel: "meta-llama/llama-3.1-8b-instruct:free" })),
      defaultSettings(),
    );
    expect(result).toEqual({ ok: false, error: "free_model" });
  });

  it("requires at least one enabled league", () => {
    const result = parseSettingsForm(form(validEntries({ league: [] })), defaultSettings());
    expect(result).toEqual({ ok: false, error: "leagues" });
  });
});
