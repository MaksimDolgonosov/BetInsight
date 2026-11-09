CREATE TABLE "tg_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prediction_id" uuid,
	"chat_id" text NOT NULL,
	"locale" text NOT NULL,
	"message_id" integer NOT NULL,
	"type" text NOT NULL,
	"dedupe" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tg_subscribers" (
	"telegram_id" text PRIMARY KEY NOT NULL,
	"username" text,
	"locale" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"leagues" jsonb,
	"quiet_hours" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "predictions" ALTER COLUMN "track" SET DEFAULT 'ai_pick';--> statement-breakpoint
CREATE UNIQUE INDEX "tg_messages_dedupe_idx" ON "tg_messages" USING btree ("dedupe");