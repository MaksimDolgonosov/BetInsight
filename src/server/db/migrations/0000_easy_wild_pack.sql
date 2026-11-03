CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" double precision,
	"latency_ms" integer,
	"raw_response" jsonb,
	"error" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"params" jsonb NOT NULL,
	"cost" integer NOT NULL,
	"remaining" integer,
	"used" integer,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"markets" jsonb NOT NULL,
	"thresholds" jsonb NOT NULL,
	"llm_model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"web_search_enabled" boolean NOT NULL,
	"monthly_credit_limit" integer NOT NULL,
	"reserve_credits" integer NOT NULL,
	"test_runs_per_day" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"sport_key" text NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	"commence_time" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"completed_at" timestamp with time zone,
	"missing_from_scores" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"point" double precision,
	"price" double precision NOT NULL,
	"bookmaker" text NOT NULL,
	"model_prob" double precision,
	"ai_prob" double precision,
	"ev" double precision,
	"confidence" text,
	"reasoning_ru" text,
	"reasoning_en" text,
	"llm_model" text,
	"prompt_version" text,
	"status" text NOT NULL,
	"profit_units" double precision,
	"published_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"key" text PRIMARY KEY NOT NULL,
	"group" text NOT NULL,
	"title" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"enabled_by_admin" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_requests_created_at_idx" ON "ai_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_usage_created_at_idx" ON "api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_idempotency_key_idx" ON "job_runs" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION predictions_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'predictions cannot be deleted';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.market IS DISTINCT FROM OLD.market
    OR NEW.selection IS DISTINCT FROM OLD.selection
    OR NEW.point IS DISTINCT FROM OLD.point
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.bookmaker IS DISTINCT FROM OLD.bookmaker
    OR NEW.model_prob IS DISTINCT FROM OLD.model_prob
    OR NEW.ai_prob IS DISTINCT FROM OLD.ai_prob
    OR NEW.ev IS DISTINCT FROM OLD.ev
    OR NEW.confidence IS DISTINCT FROM OLD.confidence
    OR NEW.reasoning_ru IS DISTINCT FROM OLD.reasoning_ru
    OR NEW.reasoning_en IS DISTINCT FROM OLD.reasoning_en
    OR NEW.llm_model IS DISTINCT FROM OLD.llm_model
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.hash IS DISTINCT FROM OLD.hash
  THEN
    RAISE EXCEPTION 'prediction fields are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER predictions_immutable_trigger
  BEFORE UPDATE OR DELETE ON predictions
  FOR EACH ROW EXECUTE FUNCTION predictions_immutable();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION predictions_before_start() RETURNS trigger AS $$
DECLARE
  kickoff timestamptz;
BEGIN
  SELECT commence_time INTO kickoff FROM events WHERE id = NEW.event_id;
  IF kickoff IS NOT NULL AND now() >= kickoff THEN
    RAISE EXCEPTION 'prediction cannot be inserted after commence_time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER predictions_before_start_trigger
  BEFORE INSERT ON predictions
  FOR EACH ROW EXECUTE FUNCTION predictions_before_start();