ALTER TABLE "predictions" ADD COLUMN "track" text DEFAULT 'value' NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "tracks_agree" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_event_track_idx" ON "predictions" USING btree ("event_id","track");--> statement-breakpoint
CREATE OR REPLACE FUNCTION predictions_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'predictions cannot be deleted';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.track IS DISTINCT FROM OLD.track
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