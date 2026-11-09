import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SportThresholds } from "@/server/domain/settings";
export { apiPayloads, oddsSnapshots } from "./data-tables";

export const sports = pgTable("sports", {
  key: text("key").primaryKey(),
  group: text("group").notNull(),
  title: text("title").notNull(),
  active: boolean("active").notNull().default(true),
  enabledByAdmin: boolean("enabled_by_admin").notNull().default(true),
});

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  region: text("region").notNull(),
  markets: jsonb("markets").$type<string[]>().notNull(),
  thresholds: jsonb("thresholds").$type<Record<string, SportThresholds>>().notNull(),
  llmModel: text("llm_model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  webSearchEnabled: boolean("web_search_enabled").notNull(),
  webSearchDailyLimit: integer("web_search_daily_limit").notNull().default(12),
  aiPickEnabled: boolean("ai_pick_enabled").notNull().default(true),
  aiPickModels: jsonb("ai_pick_models").$type<string[]>().notNull().default([
    "openai/gpt-6.1-terra",
    "anthropic/claude-haiku-5.5",
    "google/gemini-3.8-flash",
  ]),
  aiPickResearchModel: text("ai_pick_research_model").notNull().default(""),
  aiPickConsensusMode: text("ai_pick_consensus_mode").notNull().default("two_thirds"),
  aiPickProbabilityTolerance: doublePrecision("ai_pick_probability_tolerance").notNull().default(0.02),
  aiPickOddsMin: doublePrecision("ai_pick_odds_min").notNull().default(1.4),
  aiPickOddsMax: doublePrecision("ai_pick_odds_max").notNull().default(2.5),
  aiPickMinEv: doublePrecision("ai_pick_min_ev").notNull().default(-0.03),
  aiPickShortlistSize: integer("ai_pick_shortlist_size").notNull().default(8),
  aiPickDailyLimit: integer("ai_pick_daily_limit").notNull().default(3),
  aiPickMonthlyBudgetUsd: doublePrecision("ai_pick_monthly_budget_usd").notNull().default(20),
  aiPickConfigured: boolean("ai_pick_configured").notNull().default(false),
  monthlyCreditLimit: integer("monthly_credit_limit").notNull(),
  reserveCredits: integer("reserve_credits").notNull(),
  testRunsPerDay: integer("test_runs_per_day").notNull(),
  statsEpochStartedAt: timestamp("stats_epoch_started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  sportKey: text("sport_key").notNull(),
  home: text("home").notNull(),
  away: text("away").notNull(),
  commenceTime: timestamp("commence_time", { withTimezone: true }).notNull(),
  status: text("status").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  missingFromScores: boolean("missing_from_scores").notNull().default(false),
});

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    track: text("track").notNull().default("ai_pick"),
    tracksAgree: boolean("tracks_agree").notNull().default(false),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    point: doublePrecision("point"),
    price: doublePrecision("price").notNull(),
    bookmaker: text("bookmaker").notNull(),
    modelProb: doublePrecision("model_prob"),
    aiProb: doublePrecision("ai_prob"),
    ev: doublePrecision("ev"),
    confidence: text("confidence"),
    reasoningRu: text("reasoning_ru"),
    reasoningEn: text("reasoning_en"),
    llmModel: text("llm_model"),
    promptVersion: text("prompt_version"),
    status: text("status").notNull(),
    profitUnits: doublePrecision("profit_units"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    hash: text("hash").notNull(),
  },
  (table) => [uniqueIndex("predictions_event_track_idx").on(table.eventId, table.track)],
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: doublePrecision("cost_usd"),
    latencyMs: integer("latency_ms"),
    rawResponse: jsonb("raw_response"),
    error: text("error"),
    webSearch: boolean("web_search").notNull().default(false),
    sources: jsonb("sources").$type<string[]>(),
    purpose: text("purpose").notNull().default("value_check"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_requests_created_at_idx").on(table.createdAt)],
);

export const modelEvaluations = pgTable(
  "model_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    home: text("home").notNull(),
    away: text("away").notNull(),
    market: text("market").notNull(),
    outcome: text("outcome").notNull(),
    point: doublePrecision("point"),
    consensusProb: doublePrecision("consensus_prob").notNull(),
    bestPrice: doublePrecision("best_price").notNull(),
    bestBookmaker: text("best_bookmaker").notNull(),
    ev: doublePrecision("ev").notNull(),
    isCandidate: boolean("is_candidate").notNull(),
    nearMiss: boolean("near_miss").notNull(),
    aiPickShortlisted: boolean("ai_pick_shortlisted").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("model_evaluations_created_at_idx").on(table.createdAt)],
);

export const aiVotes = pgTable(
  "ai_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    aiRequestId: uuid("ai_request_id"),
    model: text("model").notNull(),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    point: doublePrecision("point"),
    probabilities: jsonb("probabilities").notNull(),
    confidence: text("confidence").notNull(),
    reasoningRu: text("reasoning_ru"),
    reasoningEn: text("reasoning_en"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_votes_event_idx").on(table.eventId)],
);

export const aiConsensus = pgTable(
  "ai_consensus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    home: text("home").notNull(),
    away: text("away").notNull(),
    models: jsonb("models").$type<string[]>().notNull(),
    voteIds: jsonb("vote_ids").$type<string[]>().notNull(),
    votesFor: integer("votes_for").notNull(),
    votesTotal: integer("votes_total").notNull(),
    pAiMean: doublePrecision("p_ai_mean"),
    pAiMin: doublePrecision("p_ai_min"),
    status: text("status").notNull(),
    market: text("market"),
    selection: text("selection"),
    point: doublePrecision("point"),
    bestPrice: doublePrecision("best_price"),
    confidence: text("confidence"),
    reasoningRu: text("reasoning_ru"),
    reasoningEn: text("reasoning_en"),
    matchesMarketFavorite: boolean("matches_market_favorite"),
    predictionId: uuid("prediction_id"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_consensus_created_at_idx").on(table.createdAt)],
);

export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: text("endpoint").notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    cost: integer("cost").notNull(),
    remaining: integer("remaining"),
    used: integer("used"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("api_usage_created_at_idx").on(table.createdAt)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    payload: jsonb("payload"),
  },
  (table) => [uniqueIndex("job_runs_idempotency_key_idx").on(table.idempotencyKey)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_created_at_idx").on(table.createdAt)],
);
