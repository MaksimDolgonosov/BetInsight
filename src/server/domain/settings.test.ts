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
      "icehockey_nhl",
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
    aiPickOddsMin: "1.4",
    aiPickOddsMax: "2.5",
    aiPickMinEvPercent: "-3",
    aiPickShortlistSize: "8",
    aiPickDailyLimit: "3",
    aiPickMonthlyBudgetUsd: "20",
    selectionWindowMinHours: "4",
    selectionWindowMaxHours: "24",
    probMinPercent: "50",
    probMaxPercent: "70",
    leagueQuota: "2",
    voteWindowStart: "8",
    voteWindowEnd: "20",
    dataScoreThreshold: "6",
    dataScoreLowConf: "4",
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
    "hockey.evPercent": "2",
    "hockey.oddsMin": "1.5",
    "hockey.oddsMax": "4",
    "hockey.minBookmakers": "3",
    "hockey.totalsPointMin": "4.5",
    "hockey.totalsPointMax": "8.5",
    "hockey.spreadsPointMin": "-2.5",
    "hockey.spreadsPointMax": "2.5",
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
  it("keeps the default leagues and the stored thresholds", () => {
    const current = defaultSettings();
    current.thresholds.soccer.evThreshold = 0.07;
    const result = parseSettingsForm(form(validEntries({ "soccer.evPercent": "0" })), current);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.thresholds.soccer.evThreshold).toBeCloseTo(0.07);
    expect(result.settings.leagues).toHaveLength(6);
    expect(result.settings.thresholds.hockey.totalsPointMin).toBe(4.5);
    expect(result.settings.thresholds.hockey.totalsPointMax).toBe(8.5);
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
    expect(result.settings.aiPick.minEv).toBeCloseTo(current.aiPick.minEv);
    expect(result.settings.aiPick.dailyLimit).toBe(3);
    expect(result.settings.selection).toEqual(defaultSettings().selection);
  });

  it("starts the selection pipeline at the version 1.8 defaults", () => {
    expect(defaultSettings().aiPick.dailyLimit).toBe(8);
    expect(defaultSettings().selection).toEqual({
      windowMinHours: 4,
      windowMaxHours: 24,
      probMin: 0.5,
      probMax: 0.7,
      leagueQuota: 2,
      voteWindowStart: 8,
      voteWindowEnd: 20,
      dataScoreThreshold: 6,
      dataScoreLowConf: 4,
    });
  });

  it("saves the selection window and rejects an inverted one", () => {
    const saved = parseSettingsForm(
      form(validEntries({ selectionWindowMinHours: "12", selectionWindowMaxHours: "36" })),
      defaultSettings(),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.settings.selection.windowMinHours).toBe(12);
    expect(saved.settings.selection.windowMaxHours).toBe(36);

    const rejected = parseSettingsForm(
      form(validEntries({ selectionWindowMinHours: "60", dataScoreLowConf: "8" })),
      defaultSettings(),
    );
    expect(rejected).toEqual({ ok: false, error: "selection_window" });
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
      form(validEntries({ aiPickModel0: "meta-llama/llama-3.1-8b-instruct:free" })),
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
