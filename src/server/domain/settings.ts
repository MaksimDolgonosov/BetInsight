import { z } from "zod";
import { PROMPTS } from "@/server/integrations/openrouter/prompt";

export const SPORT_GROUPS = ["soccer", "basketball"] as const;
export const MARKETS = ["h2h", "totals"] as const;

export type SportGroup = (typeof SPORT_GROUPS)[number];
export type Market = (typeof MARKETS)[number];

export type SportThresholds = {
  evThreshold: number;
  oddsMin: number;
  oddsMax: number;
  minBookmakers: number;
  totalsPointMin: number;
  totalsPointMax: number;
};

export type LeagueSetting = {
  key: string;
  group: SportGroup;
  title: string;
  enabled: boolean;
};

export type AdminSettings = {
  region: string;
  markets: Market[];
  leagues: LeagueSetting[];
  thresholds: Record<SportGroup, SportThresholds>;
  llmModel: string;
  promptVersion: string;
  webSearchEnabled: boolean;
  monthlyCreditLimit: number;
  reserveCredits: number;
  testRunsPerDay: number;
};

export const LEAGUE_CATALOG: Omit<LeagueSetting, "enabled">[] = [
  { key: "soccer_spain_la_liga", group: "soccer", title: "La Liga" },
  { key: "soccer_germany_bundesliga", group: "soccer", title: "Bundesliga" },
  { key: "soccer_uefa_champs_league", group: "soccer", title: "UEFA Champions League" },
  { key: "basketball_euroleague", group: "basketball", title: "Euroleague" },
];

export const DEFAULT_LLM_MODEL = "anthropic/claude-sonnet-5.5";

const soccerThresholds: SportThresholds = {
  evThreshold: 0.02,
  oddsMin: 1.5,
  oddsMax: 4,
  minBookmakers: 3,
  totalsPointMin: 0.5,
  totalsPointMax: 5.5,
};

const basketballThresholds: SportThresholds = {
  evThreshold: 0.02,
  oddsMin: 1.5,
  oddsMax: 4,
  minBookmakers: 3,
  totalsPointMin: 140,
  totalsPointMax: 190,
};

export function defaultSettings(model = DEFAULT_LLM_MODEL): AdminSettings {
  return {
    region: "eu",
    markets: ["h2h", "totals"],
    leagues: LEAGUE_CATALOG.map((league) => ({ ...league, enabled: true })),
    thresholds: {
      soccer: { ...soccerThresholds },
      basketball: { ...basketballThresholds },
    },
    llmModel: model,
    promptVersion: "v1",
    webSearchEnabled: false,
    monthlyCreditLimit: 500,
    reserveCredits: 50,
    testRunsPerDay: 3,
  };
}

const thresholdsSchema = z.object({
  evThreshold: z.number().gt(0).lt(1),
  oddsMin: z.number().gt(1),
  oddsMax: z.number().gt(1),
  minBookmakers: z.number().int().min(1).max(30),
  totalsPointMin: z.number().positive(),
  totalsPointMax: z.number().positive(),
});

export const adminSettingsSchema = z
  .object({
    region: z.string().trim().regex(/^[a-z]{2,8}$/),
    markets: z.array(z.enum(MARKETS)).min(1),
    leagues: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z0-9_]{3,80}$/),
          group: z.enum(SPORT_GROUPS),
          title: z.string().trim().min(2).max(80),
          enabled: z.boolean(),
        }),
      )
      .min(1)
      .max(12),
    thresholds: z.object({
      soccer: thresholdsSchema,
      basketball: thresholdsSchema,
    }),
    llmModel: z.string().trim().min(3).max(120),
    promptVersion: z.string().refine((version) => version in PROMPTS),
    webSearchEnabled: z.boolean(),
    monthlyCreditLimit: z.number().int().min(1).max(100000),
    reserveCredits: z.number().int().min(0),
    testRunsPerDay: z.number().int().min(1).max(24),
  })
  .superRefine((value, context) => {
    if (value.reserveCredits >= value.monthlyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["reserveCredits"],
        message: "reserve",
      });
    }

    for (const group of SPORT_GROUPS) {
      const thresholds = value.thresholds[group];
      if (thresholds.oddsMin > thresholds.oddsMax) {
        context.addIssue({
          code: "custom",
          path: ["thresholds", group, "oddsMin"],
          message: "odds_range",
        });
      }
      if (thresholds.totalsPointMin > thresholds.totalsPointMax) {
        context.addIssue({
          code: "custom",
          path: ["thresholds", group, "totalsPointMin"],
          message: "totals_range",
        });
      }
    }

    const enabled = value.leagues.filter((league) => league.enabled);
    if (enabled.length === 0) {
      context.addIssue({ code: "custom", path: ["leagues"], message: "leagues" });
    }

    const keys = value.leagues.map((league) => league.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: "custom", path: ["leagues"], message: "duplicate" });
    }

    if (value.llmModel.endsWith(":free")) {
      context.addIssue({ code: "custom", path: ["llmModel"], message: "free_model" });
    }
  });

export type SettingsError =
  | "invalid"
  | "reserve"
  | "odds_range"
  | "totals_range"
  | "leagues"
  | "duplicate"
  | "free_model"
  | "unknown_prompt";

function numberField(formData: FormData, name: string): number {
  return Number(formData.get(name));
}

function thresholdsFromForm(formData: FormData, group: SportGroup): SportThresholds {
  return {
    evThreshold: numberField(formData, `${group}.evPercent`) / 100,
    oddsMin: numberField(formData, `${group}.oddsMin`),
    oddsMax: numberField(formData, `${group}.oddsMax`),
    minBookmakers: numberField(formData, `${group}.minBookmakers`),
    totalsPointMin: numberField(formData, `${group}.totalsPointMin`),
    totalsPointMax: numberField(formData, `${group}.totalsPointMax`),
  };
}

export function parseSettingsForm(
  formData: FormData,
  current: AdminSettings,
): { ok: true; settings: AdminSettings } | { ok: false; error: SettingsError } {
  const enabledKeys = new Set(formData.getAll("league").map(String));
  const markets = formData.getAll("market").map(String);
  const leagues = current.leagues.map((league) => ({
    ...league,
    enabled: enabledKeys.has(league.key),
  }));

  const newKey = String(formData.get("newLeagueKey") ?? "").trim();
  const newTitle = String(formData.get("newLeagueTitle") ?? "").trim();
  const newGroup = String(formData.get("newLeagueGroup") ?? "").trim();
  if (newKey || newTitle || newGroup) {
    if (!newKey || !newTitle || (newGroup !== "soccer" && newGroup !== "basketball")) {
      return { ok: false, error: "invalid" };
    }
    leagues.push({
      key: newKey,
      group: newGroup,
      title: newTitle,
      enabled: true,
    });
  }

  const parsed = adminSettingsSchema.safeParse({
    region: String(formData.get("region") ?? ""),
    markets,
    leagues,
    thresholds: {
      soccer: thresholdsFromForm(formData, "soccer"),
      basketball: thresholdsFromForm(formData, "basketball"),
    },
    llmModel: String(formData.get("llmModel") ?? ""),
    promptVersion: String(formData.get("promptVersion") ?? ""),
    webSearchEnabled: formData.get("webSearchEnabled") === "on",
    monthlyCreditLimit: numberField(formData, "monthlyCreditLimit"),
    reserveCredits: numberField(formData, "reserveCredits"),
    testRunsPerDay: numberField(formData, "testRunsPerDay"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    if (
      message === "reserve" ||
      message === "odds_range" ||
      message === "totals_range" ||
      message === "leagues" ||
      message === "duplicate" ||
      message === "free_model"
    ) {
      return { ok: false, error: message };
    }
    if (parsed.error.issues.some((issue) => issue.path.includes("promptVersion"))) {
      return { ok: false, error: "unknown_prompt" };
    }
    return { ok: false, error: "invalid" };
  }

  return { ok: true, settings: parsed.data };
}
