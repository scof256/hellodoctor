-- Create context_layer enum type for separating patient intake from doctor enhancements
DO $$ BEGIN
 CREATE TYPE "public"."context_layer" AS ENUM('patient-intake', 'doctor-enhancement');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Add contextLayer field to chat_messages table
ALTER TABLE "chat_messages" ADD COLUMN "context_layer" "context_layer" DEFAULT 'patient-intake' NOT NULL;
--> statement-breakpoint
-- Create index for efficient querying by context layer
CREATE INDEX IF NOT EXISTS "chat_messages_context_layer_idx" ON "chat_messages" USING btree ("context_layer");
--> statement-breakpoint
-- Create composite index for filtering by session and context layer
CREATE INDEX IF NOT EXISTS "chat_messages_session_context_idx" ON "chat_messages" USING btree ("session_id", "context_layer");
