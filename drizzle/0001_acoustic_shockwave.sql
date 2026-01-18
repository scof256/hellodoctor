CREATE TABLE IF NOT EXISTS "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_invitations_token_unique'
      AND conrelid = 'team_invitations'::regclass
  ) THEN
    ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_token_unique" UNIQUE("token");
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_invitations_doctor_id_doctors_id_fk'
      AND conrelid = 'team_invitations'::regclass
  ) THEN
    ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_invitations_invited_by_users_id_fk'
      AND conrelid = 'team_invitations'::regclass
  ) THEN
    ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_invitations_accepted_by_users_id_fk'
      AND conrelid = 'team_invitations'::regclass
  ) THEN
    ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "team_invitations_doctor_id_idx" ON "team_invitations" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_email_idx" ON "team_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_token_idx" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_connection_status_idx" ON "appointments" USING btree ("connection_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_scheduled_status_idx" ON "appointments" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_session_created_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "direct_messages_connection_read_idx" ON "direct_messages" USING btree ("connection_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_sessions_connection_status_idx" ON "intake_sessions" USING btree ("connection_id","status");