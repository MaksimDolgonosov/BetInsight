CREATE TABLE "rivalry_pairs" (
	"sport_key" text NOT NULL,
	"team_a" text NOT NULL,
	"team_b" text NOT NULL,
	"label" text,
	CONSTRAINT "rivalry_pairs_sport_key_team_a_team_b_pk" PRIMARY KEY("sport_key","team_a","team_b")
);
--> statement-breakpoint
CREATE TABLE "team_meta" (
	"team_name" text NOT NULL,
	"sport_key" text NOT NULL,
	"league_key" text NOT NULL,
	"table_rank" smallint,
	"is_relegation" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_meta_team_name_league_key_pk" PRIMARY KEY("team_name","league_key")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "ai_pick_daily_limit" SET DEFAULT 8;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "selection_window_min_hours" smallint DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "selection_window_max_hours" smallint DEFAULT 54 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "daily_quotas" jsonb DEFAULT '{"per_league":3,"tennis":2}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "data_score_threshold" smallint DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "data_score_low_conf" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "significance_score" smallint;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "form_home" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "form_away" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "form_delta" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "form_bonus" smallint;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "final_score" smallint;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "data_score" smallint;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "research_summary" text;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "discard_reason" text;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "low_confidence" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "form_source" text;--> statement-breakpoint
UPDATE "app_settings" SET "ai_pick_daily_limit" = 8 WHERE "ai_pick_daily_limit" = 3;