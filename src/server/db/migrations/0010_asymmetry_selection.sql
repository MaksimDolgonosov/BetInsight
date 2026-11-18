ALTER TABLE "app_settings" ADD COLUMN "prob_min" numeric(4, 3) DEFAULT 0.60 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "prob_max" numeric(4, 3) DEFAULT 0.70 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "league_quota" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "vote_window_start" smallint DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "vote_window_end" smallint DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "asymmetry_score" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "model_evaluations" ADD COLUMN "asymmetry_market" text;
