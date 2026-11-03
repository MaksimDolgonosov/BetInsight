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
  monthlyCreditLimit: integer("monthly_credit_limit").notNull(),
  reserveCredits: integer("reserve_credits").notNull(),
  testRunsPerDay: integer("test_runs_per_day").notNull(),
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

export const predictions = pgTable("predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull(),
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
});

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
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_requests_created_at_idx").on(table.createdAt)],
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
