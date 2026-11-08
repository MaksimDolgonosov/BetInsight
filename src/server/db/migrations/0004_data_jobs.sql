CREATE TABLE "api_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"sport_key" text,
	"day" text,
	"purpose" text,
	"cost" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"used" integer,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"bookmaker" text NOT NULL,
	"market" text NOT NULL,
	"outcome" text NOT NULL,
	"point" double precision,
	"price" double precision NOT NULL,
	"is_closing" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_payloads_created_at_idx" ON "api_payloads" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_payloads_call_idx" ON "api_payloads" USING btree ("endpoint","sport_key","day","purpose");--> statement-breakpoint
CREATE INDEX "odds_snapshots_event_idx" ON "odds_snapshots" USING btree ("event_id");