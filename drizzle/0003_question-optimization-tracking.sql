-- Migration: Add question optimization tracking fields
-- Requirements: 2.4, 3.4, 4.5
-- 
-- This migration adds columns to track:
-- - follow_up_counts: Number of follow-up messages per stage (max 2)
-- - answered_topics: Topics already answered by the patient (to avoid re-asking)
-- - consecutive_errors: Count of consecutive AI errors (for fallback handling)

-- Add follow_up_counts column with default empty object
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "follow_up_counts" jsonb DEFAULT '{}'::jsonb;

-- Add answered_topics column with default empty array
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "answered_topics" jsonb DEFAULT '[]'::jsonb;

-- Add consecutive_errors column with default 0
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "consecutive_errors" integer NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN "intake_sessions"."follow_up_counts" IS 'Tracks follow-up message count per stage (max 2 per stage)';
COMMENT ON COLUMN "intake_sessions"."answered_topics" IS 'List of topics already answered by patient to prevent re-asking';
COMMENT ON COLUMN "intake_sessions"."consecutive_errors" IS 'Count of consecutive AI errors for fallback message handling';
