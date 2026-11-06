CREATE TABLE "ai_consensus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"models" jsonb NOT NULL,
	"vote_ids" jsonb NOT NULL,
	"votes_for" integer NOT NULL,
	"votes_total" integer NOT NULL,
	"p_ai_mean" double precision,
	"p_ai_min" double precision,
	"status" text NOT NULL,
	"market" text,
	"selection" text,
	"point" double precision,
	"best_price" double precision,
	"confidence" text,
	"reasoning_ru" text,
	"reasoning_en" text,
	"matches_market_favorite" boolean,
	"prediction_id" uuid,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"ai_request_id" uuid,
	"model" text NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"point" double precision,
	"probabilities" jsonb NOT NULL,
	"confidence" text NOT NULL,
	"reasoning_ru" text,
	"reasoning_en" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"market" text NOT NULL,
	"outcome" text NOT NULL,
	"point" double precision,
	"consensus_prob" double precision NOT NULL,
	"best_price" double precision NOT NULL,
	"best_bookmaker" text NOT NULL,
	"ev" double precision NOT NULL,
	"is_candidate" boolean NOT NULL,
	"near_miss" boolean NOT NULL,
	"ai_pick_shortlisted" boolean NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "web_search" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "purpose" text DEFAULT 'value_check' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "web_search_daily_limit" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_models" jsonb DEFAULT '["openai/gpt-6.1-terra","anthropic/claude-haiku-5.5","google/gemini-3.8-flash"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_research_model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_consensus_mode" text DEFAULT 'two_thirds' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_probability_tolerance" double precision DEFAULT 0.02 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_odds_min" double precision DEFAULT 1.4 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_odds_max" double precision DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_min_ev" double precision DEFAULT -0.03 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_shortlist_size" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_daily_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ai_pick_monthly_budget_usd" double precision DEFAULT 20 NOT NULL;--> statement-breakpoint
CREATE INDEX "ai_consensus_created_at_idx" ON "ai_consensus" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_votes_event_idx" ON "ai_votes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "model_evaluations_created_at_idx" ON "model_evaluations" USING btree ("created_at");