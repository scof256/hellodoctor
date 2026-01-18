ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_is_active" boolean NOT NULL DEFAULT false;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_activated_at" timestamp;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_deactivated_at" timestamp;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_transcript" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_summary" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_soap" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_action_items" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_risk_assessment" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "scribe_updated_at" timestamp;
