import { z } from "zod";
import type { ConsensusMode } from "@/server/domain/predictions/ai-pick";
import { PROMPTS } from "@/server/integrations/openrouter/prompt";

export const SPORT_GROUPS = ["soccer", "basketball", "nba", "tennis"] as const;
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

export type AiPickSettings = {
  enabled: boolean;
  models: [string, string, string];
  researchModel: string;
  consensusMode: ConsensusMode;
  probabilityTolerance: number;
  oddsMin: number;
  oddsMax: number;
  minEv: number;
  shortlistSize: number;
  dailyLimit: number;
  monthlyBudgetUsd: number;
};

export type AdminSettings = {
  region: string;
  markets: Market[];
  leagues: LeagueSetting[];
  thresholds: Record<SportGroup, SportThresholds>;
  llmModel: string;
  promptVersion: string;
  webSearchEnabled: boolean;
  webSearchDailyLimit: number;
  aiPick: AiPickSettings;
  monthlyCreditLimit: number;
  reserveCredits: number;
  testRunsPerDay: number;
};

export const LEAGUE_CATALOG: Omit<LeagueSetting, "enabled">[] = [
  { key: "soccer_spain_la_liga", group: "soccer", title: "La Liga" },
  { key: "soccer_germany_bundesliga", group: "soccer", title: "Bundesliga" },
  { key: "soccer_uefa_champs_league", group: "soccer", title: "UEFA Champions League" },
  { key: "basketball_euroleague", group: "basketball", title: "Euroleague" },
  { key: "basketball_nba", group: "nba", title: "NBA" },
];

export const DEFAULT_LLM_MODEL = "anthropic/claude-sonnet-5.5";
export const DEFAULT_AI_PICK_MODELS = [
  "openai/gpt-6.1-terra",
  "anthropic/claude-haiku-5.5",
  "google/gemini-3.8-flash",
] as const;

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

const nbaThresholds: SportThresholds = {
  evThreshold: 0.02,
  oddsMin: 1.5,
  oddsMax: 4,
  minBookmakers: 3,
  totalsPointMin: 200,
  totalsPointMax: 260,
};

const tennisThresholds: SportThresholds = {
  evThreshold: 0.02,
  oddsMin: 1.5,
  oddsMax: 4,
  minBookmakers: 3,
  totalsPointMin: 16,
  totalsPointMax: 45,
};

export function isSportGroup(value: string): value is SportGroup {
  return (SPORT_GROUPS as readonly string[]).includes(value);
}

export function isConcreteModel(value: string): boolean {
  const model = value.trim();
  if (!model || model.includes("~") || model.endsWith("-latest") || model.endsWith(":free")) return false;
  return /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(model);
}

export function modelProvider(model: string): string {
  return model.split("/")[0] ?? "";
}

export function aiPickFromEnv(fallback: AiPickSettings): AiPickSettings {
  const models = [1, 2, 3].map((index, position) => envModel(`OPENROUTER_AI_PICK_MODEL_${index}`, fallback.models[position]));
  const researchModel = process.env.OPENROUTER_AI_PICK_RESEARCH_MODEL?.trim() || fallback.researchModel;
  const concrete = models.every(isConcreteModel);
  const distinct = new Set(models).size === 3 && new Set(models.map(modelProvider)).size === 3;
  const researchOk = !researchModel || (isConcreteModel(researchModel) && !models.includes(researchModel));
  return {
    ...fallback,
    models: concrete && distinct ? [models[0]!, models[1]!, models[2]!] : fallback.models,
    researchModel: researchOk ? researchModel : fallback.researchModel,
  };
}

function envModel(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function defaultAiPick(): AiPickSettings {
  const fallback: AiPickSettings = {
    enabled: true,
    models: [...DEFAULT_AI_PICK_MODELS],
    researchModel: "",
    consensusMode: "two_thirds",
    probabilityTolerance: 0.02,
    oddsMin: 1.4,
    oddsMax: 2.5,
    minEv: -0.03,
    shortlistSize: 8,
    dailyLimit: 3,
    monthlyBudgetUsd: 20,
  };
  return aiPickFromEnv(fallback);
}

function mergeAiPick(stored: AiPickSettings | undefined, fallback: AiPickSettings): AiPickSettings {
  if (!stored) return fallback;
  const models = stored.models?.length === 3 ? stored.models : fallback.models;
  return {
    enabled: stored.enabled ?? fallback.enabled,
    models: [models[0] || fallback.models[0], models[1] || fallback.models[1], models[2] || fallback.models[2]],
    researchModel: stored.researchModel ?? fallback.researchModel,
    consensusMode: stored.consensusMode === "unanimous" ? "unanimous" : "two_thirds",
    probabilityTolerance: stored.probabilityTolerance ?? fallback.probabilityTolerance,
    oddsMin: stored.oddsMin ?? fallback.oddsMin,
    oddsMax: stored.oddsMax ?? fallback.oddsMax,
    minEv: stored.minEv ?? fallback.minEv,
    shortlistSize: stored.shortlistSize ?? fallback.shortlistSize,
    dailyLimit: stored.dailyLimit ?? fallback.dailyLimit,
    monthlyBudgetUsd: stored.monthlyBudgetUsd ?? fallback.monthlyBudgetUsd,
  };
}

export function hydrateSettings(settings: AdminSettings): AdminSettings {
  const defaults = defaultSettings(settings.llmModel);
  const incoming = settings as Partial<AdminSettings>;
  const leagues = [...settings.leagues];
  for (const league of defaults.leagues) {
    if (!leagues.some((item) => item.key === league.key)) {
      leagues.push({ ...league, enabled: true });
    }
  }

  const stored = settings.thresholds as Partial<Record<SportGroup, SportThresholds>> | undefined;
  const thresholds = {} as Record<SportGroup, SportThresholds>;
  for (const group of SPORT_GROUPS) {
    const current = stored?.[group];
    thresholds[group] = current ? { ...defaults.thresholds[group], ...current } : { ...defaults.thresholds[group] };
  }

  return {
    ...defaults,
    ...settings,
    leagues,
    thresholds,
    webSearchDailyLimit: incoming.webSearchDailyLimit ?? defaults.webSearchDailyLimit,
    aiPick: mergeAiPick(incoming.aiPick, defaults.aiPick),
  };
}

export function defaultSettings(model = DEFAULT_LLM_MODEL): AdminSettings {
  return {
    region: "eu",
    markets: ["h2h", "totals"],
    leagues: LEAGUE_CATALOG.map((league) => ({ ...league, enabled: true })),
    thresholds: {
      soccer: { ...soccerThresholds },
      basketball: { ...basketballThresholds },
      nba: { ...nbaThresholds },
      tennis: { ...tennisThresholds },
    },
    llmModel: model,
    promptVersion: "v1",
    webSearchEnabled: true,
    webSearchDailyLimit: 12,
    aiPick: defaultAiPick(),
    monthlyCreditLimit: 500,
    reserveCredits: 50,
    testRunsPerDay: 3,
  };
}

const thresholdsSchema = z.object({
  evThreshold: z.number().gte(0).lt(1),
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
      nba: thresholdsSchema,
      tennis: thresholdsSchema,
    }),
    llmModel: z.string().trim().min(3).max(120),
    promptVersion: z.string().refine((version) => version in PROMPTS),
    webSearchEnabled: z.boolean(),
    webSearchDailyLimit: z.number().int().min(0).max(100),
    aiPick: z.object({
      enabled: z.boolean(),
      models: z.tuple([z.string().trim().min(3).max(120), z.string().trim().min(3).max(120), z.string().trim().min(3).max(120)]),
      researchModel: z.string().trim().max(120),
      consensusMode: z.enum(["two_thirds", "unanimous"]),
      probabilityTolerance: z.number().min(0).max(0.2),
      oddsMin: z.number().gt(1),
      oddsMax: z.number().gt(1),
      minEv: z.number().min(-0.5).max(0.5),
      shortlistSize: z.number().int().min(1).max(8),
      dailyLimit: z.number().int().min(0).max(20),
      monthlyBudgetUsd: z.number().min(0).max(100),
    }),
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

    if (!isConcreteModel(value.llmModel)) {
      context.addIssue({
        code: "custom",
        path: ["llmModel"],
        message: value.llmModel.endsWith(":free") ? "free_model" : "ai_pick_alias",
      });
    }

    const providers = value.aiPick.models.map(modelProvider);
    if (new Set(value.aiPick.models).size !== 3 || new Set(providers).size !== 3) {
      context.addIssue({ code: "custom", path: ["aiPick", "models"], message: "ai_pick_providers" });
    }
    if (value.aiPick.models.some((model) => !isConcreteModel(model))) {
      context.addIssue({
        code: "custom",
        path: ["aiPick", "models"],
        message: value.aiPick.models.some((model) => model.endsWith(":free")) ? "free_model" : "ai_pick_alias",
      });
    }
    if (value.aiPick.researchModel) {
      if (!isConcreteModel(value.aiPick.researchModel)) {
        context.addIssue({
          code: "custom",
          path: ["aiPick", "researchModel"],
          message: value.aiPick.researchModel.endsWith(":free") ? "free_model" : "ai_pick_alias",
        });
      }
      if (value.aiPick.models.includes(value.aiPick.researchModel)) {
        context.addIssue({ code: "custom", path: ["aiPick", "researchModel"], message: "ai_pick_research" });
      }
    }
    if (value.aiPick.oddsMin > value.aiPick.oddsMax) {
      context.addIssue({ code: "custom", path: ["aiPick", "oddsMin"], message: "ai_pick_range" });
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
  | "unknown_prompt"
  | "ai_pick_providers"
  | "ai_pick_alias"
  | "ai_pick_research"
  | "ai_pick_range";

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
    if (!newKey || !newTitle || !isSportGroup(newGroup)) {
      return { ok: false, error: "invalid" };
    }
    leagues.push({
      key: newKey,
      group: newGroup,
      title: newTitle,
      enabled: true,
    });
  }

  const thresholds = Object.fromEntries(
    SPORT_GROUPS.map((group) => [group, thresholdsFromForm(formData, group)]),
  ) as Record<SportGroup, SportThresholds>;

  const parsed = adminSettingsSchema.safeParse({
    region: String(formData.get("region") ?? ""),
    markets,
    leagues,
    thresholds,
    llmModel: String(formData.get("llmModel") ?? ""),
    promptVersion: String(formData.get("promptVersion") ?? ""),
    webSearchEnabled: formData.get("webSearchEnabled") === "on",
    webSearchDailyLimit: numberField(formData, "webSearchDailyLimit"),
    aiPick: {
      enabled: formData.get("aiPickEnabled") === "on",
      models: [
        String(formData.get("aiPickModel0") ?? ""),
        String(formData.get("aiPickModel1") ?? ""),
        String(formData.get("aiPickModel2") ?? ""),
      ],
      researchModel: String(formData.get("aiPickResearchModel") ?? ""),
      consensusMode: String(formData.get("aiPickConsensusMode") ?? ""),
      probabilityTolerance: numberField(formData, "aiPickTolerancePoints") / 100,
      oddsMin: numberField(formData, "aiPickOddsMin"),
      oddsMax: numberField(formData, "aiPickOddsMax"),
      minEv: numberField(formData, "aiPickMinEvPercent") / 100,
      shortlistSize: numberField(formData, "aiPickShortlistSize"),
      dailyLimit: numberField(formData, "aiPickDailyLimit"),
      monthlyBudgetUsd: numberField(formData, "aiPickMonthlyBudgetUsd"),
    },
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
      message === "free_model" ||
      message === "ai_pick_providers" ||
      message === "ai_pick_alias" ||
      message === "ai_pick_research" ||
      message === "ai_pick_range"
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
