ALTER TABLE "app_settings" ALTER COLUMN "selection_window_min_hours" SET DEFAULT 4;--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "selection_window_max_hours" SET DEFAULT 24;--> statement-breakpoint
UPDATE "app_settings" SET "selection_window_min_hours" = 4, "selection_window_max_hours" = 24 WHERE "selection_window_min_hours" = 20 AND "selection_window_max_hours" = 54;
