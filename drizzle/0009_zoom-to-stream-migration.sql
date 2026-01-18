-- Migration: Zoom to Stream Video Integration Data Migration
-- This migration handles the data transformation from Zoom to Stream format
-- 
-- Requirements: 6.4, 6.5
-- - Maintains all existing appointment metadata and database relationships
-- - Handles data transformation from Zoom to Stream format
--
-- Note: This migration should be run AFTER the TypeScript migration script
-- (scripts/migrate-zoom-to-stream.ts) has been executed to migrate existing data.

-- Step 1: Ensure Stream columns exist (idempotent)
ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_call_id" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_join_url" text;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_created_at" timestamp;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "stream_metadata" jsonb;

-- Step 2: Create index on stream_call_id for faster lookups
CREATE INDEX IF NOT EXISTS "appointments_stream_call_id_idx" ON "appointments" ("stream_call_id");

-- Step 3: Migrate any remaining Zoom appointments that haven't been migrated yet
-- This is a fallback in case the TypeScript script wasn't run
UPDATE "appointments"
SET 
  stream_call_id = 'appointment_' || id::text,
  stream_join_url = COALESCE(
    (SELECT value->>'baseUrl' FROM platform_config WHERE key = 'app_url'),
    'http://localhost:3000'
  ) || '/meeting/' || id::text,
  stream_created_at = NOW(),
  stream_metadata = jsonb_build_object(
    'appointmentType', 'consultation',
    'duration', duration,
    'migratedFromZoom', true,
    'originalZoomMeetingId', zoom_meeting_id,
    'migrationDate', NOW()::text
  ),
  updated_at = NOW()
WHERE 
  (zoom_meeting_id IS NOT NULL OR zoom_join_url IS NOT NULL OR is_online = true)
  AND stream_call_id IS NULL;

-- Step 4: Add comment to track migration status
COMMENT ON TABLE "appointments" IS 'Appointments table - migrated from Zoom to Stream Video on migration 0009';

-- Note: Zoom columns are intentionally NOT dropped to preserve historical data
-- and allow for rollback if needed. They can be dropped in a future migration
-- after confirming Stream integration is stable.
--
-- To drop Zoom columns in the future, run:
-- ALTER TABLE "appointments" DROP COLUMN IF EXISTS "zoom_meeting_id";
-- ALTER TABLE "appointments" DROP COLUMN IF EXISTS "zoom_join_url";
-- ALTER TABLE "appointments" DROP COLUMN IF EXISTS "zoom_start_url";
-- ALTER TABLE "appointments" DROP COLUMN IF EXISTS "zoom_created_at";
