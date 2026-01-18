ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_call_id" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_join_url" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_created_at" timestamp;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_metadata" jsonb;