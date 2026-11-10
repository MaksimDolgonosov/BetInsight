import { describe, expect, it } from "vitest";
import { defaultSettings, hydrateSettings, parseSettingsForm } from "./settings";

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
      "basketball_nba",
    ],
    market: ["h2h", "totals", "spreads"],
    region: "eu",
    llmModel: "anthropic/claude-sonnet-5.5",
    promptVersion: "v1",
    webSearchDailyLimit: "12",
    aiPickModel0: "openai/gpt-6.1-terra",
    aiPickModel1: "anthropic/claude-haiku-5.5",
    aiPickModel2: "google/gemini-3.8-flash",
    aiPickResearchModel: "perplexity/sonar",
    aiPickConsensusMode: "two_thirds",
    aiPickTolerancePoints: "2",
    aiPickOddsMin: "1.4",
    aiPickOddsMax: "2.5",
    aiPickMinEvPercent: "-3",
    aiPickShortlistSize: "8",
    aiPickDailyLimit: "3",
    aiPickMonthlyBudgetUsd: "20",
    monthlyCreditLimit: "500",
    reserveCredits: "50",
    testRunsPerDay: "3",
    "soccer.evPercent": "2",
    "soccer.oddsMin": "1.5",
    "soccer.oddsMax": "4",
    "soccer.minBookmakers": "3",
    "soccer.totalsPointMin": "0.5",
    "soccer.totalsPointMax": "5.5",
    "soccer.spreadsPointMin": "-2.5",
    "soccer.spreadsPointMax": "2.5",
    "basketball.evPercent": "2",
    "basketball.oddsMin": "1.5",
    "basketball.oddsMax": "4",
    "basketball.minBookmakers": "3",
    "basketball.totalsPointMin": "140",
    "basketball.totalsPointMax": "190",
    "basketball.spreadsPointMin": "-20.5",
    "basketball.spreadsPointMax": "20.5",
    "nba.evPercent": "2",
    "nba.oddsMin": "1.5",
    "nba.oddsMax": "4",
    "nba.minBookmakers": "3",
    "nba.totalsPointMin": "200",
    "nba.totalsPointMax": "260",
    "nba.spreadsPointMin": "-18.5",
    "nba.spreadsPointMax": "18.5",
    "tennis.evPercent": "2",
    "tennis.oddsMin": "1.5",
    "tennis.oddsMax": "4",
    "tennis.minBookmakers": "3",
    "tennis.totalsPointMin": "16",
    "tennis.totalsPointMax": "45",
    "tennis.spreadsPointMin": "-8.5",
    "tennis.spreadsPointMax": "8.5",
    ...overrides,
  };
}

describe("parseSettingsForm", () => {
  it("keeps the default leagues and converts the EV percent", () => {
    const result = parseSettingsForm(form(validEntries()), defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.thresholds.soccer.evThreshold).toBeCloseTo(0.02);
    expect(result.settings.leagues).toHaveLength(5);
    expect(result.settings.thresholds.nba.totalsPointMin).toBe(200);
    expect(result.settings.thresholds.tennis.totalsPointMax).toBe(45);
    expect(result.settings.thresholds.soccer.spreadsPointMin).toBe(-2.5);
    expect(result.settings.thresholds.tennis.spreadsExcludedAbs).toEqual([1.5]);
    expect(result.settings.markets).toEqual(["h2h", "totals", "spreads"]);
    expect(result.settings.webSearchEnabled).toBe(false);
    expect(result.settings.aiPick.enabled).toBe(false);
    expect(result.settings.aiPick.models).toEqual([
      "openai/gpt-6.1-terra",
      "anthropic/claude-haiku-5.5",
      "google/gemini-3.8-flash",
    ]);
    expect(result.settings.aiPick.minEv).toBeCloseTo(-0.03);
    expect(result.settings.aiPick.probabilityTolerance).toBeCloseTo(0.02);
  });

  it("allows an EV threshold of zero", () => {
    const result = parseSettingsForm(form(validEntries({ "soccer.evPercent": "0" })), defaultSettings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.thresholds.soccer.evThreshold).toBe(0);
  });

  it("rejects voting models from the same provider", () => {
    const result = parseSettingsForm(
      form(validEntries({ aiPickModel2: "openai/gpt-6.1-terra-mini" })),
      defaultSettings(),
    );
    expect(result).toEqual({ ok: false, error: "ai_pick_providers" });
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

  it("adds NBA to saved settings and keeps the Euroleague totals range", () => {
    const current = defaultSettings();
    current.leagues = current.leagues.filter((league) => league.key !== "basketball_nba");
    current.thresholds.basketball.totalsPointMax = 190;
    delete (current.thresholds as Partial<typeof current.thresholds>).nba;
    delete (current.thresholds as Partial<typeof current.thresholds>).tennis;

    const hydrated = hydrateSettings(current);
    expect(hydrated.leagues.map((league) => league.key)).toContain("basketball_nba");
    expect(hydrated.thresholds.basketball.totalsPointMax).toBe(190);
    expect(hydrated.thresholds.nba.totalsPointMin).toBe(200);
    expect(hydrated.thresholds.tennis.totalsPointMin).toBe(16);
    expect(hydrated.aiPick.models).toHaveLength(3);
    expect(hydrated.webSearchDailyLimit).toBe(12);
  });

  it("requires at least one enabled league", () => {
    const result = parseSettingsForm(form(validEntries({ league: [] })), defaultSettings());
    expect(result).toEqual({ ok: false, error: "leagues" });
  });
});
