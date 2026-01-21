-- Migration: Add database-level immutability constraints for patient-intake messages
-- This ensures that messages with contextLayer='patient-intake' cannot be updated or deleted
-- Requirements: 5.5, 5.8

-- Create a function to prevent updates to patient-intake messages
CREATE OR REPLACE FUNCTION prevent_patient_intake_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the OLD record has contextLayer = 'patient-intake'
  IF OLD.context_layer = 'patient-intake' THEN
    RAISE EXCEPTION 'Cannot modify patient-intake messages. Patient intake data is immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to prevent deletion of patient-intake messages
CREATE OR REPLACE FUNCTION prevent_patient_intake_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the record being deleted has contextLayer = 'patient-intake'
  IF OLD.context_layer = 'patient-intake' THEN
    RAISE EXCEPTION 'Cannot delete patient-intake messages. Patient intake data is immutable.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent UPDATE operations on patient-intake messages
DROP TRIGGER IF EXISTS prevent_patient_intake_update ON "chat_messages";
CREATE TRIGGER prevent_patient_intake_update
  BEFORE UPDATE ON "chat_messages"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_patient_intake_modification();

-- Create trigger to prevent DELETE operations on patient-intake messages
DROP TRIGGER IF EXISTS prevent_patient_intake_delete ON "chat_messages";
CREATE TRIGGER prevent_patient_intake_delete
  BEFORE DELETE ON "chat_messages"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_patient_intake_deletion();

-- Add a comment to the table documenting the immutability guarantee
COMMENT ON COLUMN "chat_messages"."context_layer" IS 'Separates patient intake messages (immutable) from doctor enhancements (editable). Patient-intake messages are protected by database triggers and cannot be updated or deleted.';
