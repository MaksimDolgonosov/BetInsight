ALTER TABLE "app_settings" ALTER COLUMN "prob_min" SET DEFAULT 0.50;--> statement-breakpoint
UPDATE "app_settings" SET "prob_min" = 0.50 WHERE "prob_min" = 0.60;
