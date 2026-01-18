ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "is_online" boolean NOT NULL DEFAULT false;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "zoom_meeting_id" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "zoom_join_url" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "zoom_start_url" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "zoom_created_at" timestamp;
