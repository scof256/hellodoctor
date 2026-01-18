-- Migration: Add termination tracking fields for intake sessions
-- Requirements: 1.4, 4.1, 4.2
-- 
-- This migration adds columns to track:
-- - ai_message_count: Total AI messages sent in the session (for limit enforcement)
-- - has_offered_conclusion: Whether we've offered to conclude at 80% completeness
-- - termination_reason: Why the intake was terminated (for analytics)

-- Add ai_message_count column with default 0
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "ai_message_count" integer NOT NULL DEFAULT 0;

-- Add has_offered_conclusion column with default false
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "has_offered_conclusion" boolean NOT NULL DEFAULT false;

-- Add termination_reason column (nullable)
ALTER TABLE "intake_sessions" 
ADD COLUMN IF NOT EXISTS "termination_reason" text;

-- Add comments for documentation
COMMENT ON COLUMN "intake_sessions"."ai_message_count" IS 'Total AI messages sent in session (offer conclusion at 15, force handover at 20)';
COMMENT ON COLUMN "intake_sessions"."has_offered_conclusion" IS 'Whether system has offered to conclude at 80% completeness';
COMMENT ON COLUMN "intake_sessions"."termination_reason" IS 'Reason for intake termination: completion_phrase, explicit_request, skip_command, done_command, message_limit, completeness_threshold';
