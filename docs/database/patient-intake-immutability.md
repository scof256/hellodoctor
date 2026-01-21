# Patient Intake Message Immutability

## Overview

The doctor intake immersive interface implements a critical architectural principle: **patient intake messages are immutable**. This document describes the immutability guarantees, their implementation, and the rationale behind this design decision.

## Design Principle

The doctor's interface operates on a **separate context layer** from the patient's intake. The patient's original intake conversation remains read-only and unmodified. When doctors add test results, exam findings, or clinical notes, these are stored in a doctor-specific enhancement layer that enriches the AI's clinical reasoning and SBAR generation without altering the patient's intake data.

This ensures:
- **Data Integrity**: Patient's original statements are never altered
- **Audit Trail**: Complete history of what the patient said vs. what the doctor added
- **Legal Protection**: Immutable patient testimony for medical-legal purposes
- **Clinical Accuracy**: AI analysis can distinguish between patient-reported symptoms and doctor-observed findings

## Context Layer Separation

Messages in the `chat_messages` table are tagged with a `context_layer` field:

- **`patient-intake`**: Original patient intake messages (immutable)
- **`doctor-enhancement`**: Doctor-added test results, exam findings, and notes (editable)

## Database-Level Immutability Guarantees

### Implementation

Immutability is enforced at the **database level** using PostgreSQL triggers, ensuring that even direct database access cannot violate this constraint.

#### Trigger Functions

Two trigger functions protect patient-intake messages:

1. **`prevent_patient_intake_modification()`**: Prevents UPDATE operations
2. **`prevent_patient_intake_deletion()`**: Prevents DELETE operations

Both functions check the `context_layer` field and raise an exception if an attempt is made to modify or delete a `patient-intake` message.

#### Triggers

Two BEFORE triggers are attached to the `chat_messages` table:

1. **`prevent_patient_intake_update`**: Fires before UPDATE operations
2. **`prevent_patient_intake_delete`**: Fires before DELETE operations

### Error Messages

When an attempt is made to modify or delete a patient-intake message, the database raises an exception with a clear error message:

- **UPDATE attempt**: `Cannot modify patient-intake messages. Patient intake data is immutable.`
- **DELETE attempt**: `Cannot delete patient-intake messages. Patient intake data is immutable.`

### Migration

The immutability constraints are implemented in migration `0012_patient-intake-immutability.sql`.

## Indexes for Efficient Querying

The following indexes support efficient querying by context layer:

1. **`chat_messages_context_layer_idx`**: Single-column index on `context_layer`
   - Supports queries filtering by context layer alone
   - Example: `SELECT * FROM chat_messages WHERE context_layer = 'patient-intake'`

2. **`chat_messages_session_context_idx`**: Composite index on `(session_id, context_layer)`
   - Supports queries filtering by both session and context layer
   - Example: `SELECT * FROM chat_messages WHERE session_id = ? AND context_layer = 'doctor-enhancement'`

3. **`chat_messages_session_created_idx`**: Composite index on `(session_id, created_at)`
   - Supports chronological ordering of messages within a session
   - Works efficiently with context layer filtering

These indexes ensure that:
- Fetching all patient-intake messages for a session is fast
- Fetching all doctor-enhancement messages for a session is fast
- Displaying messages in chronological order is efficient
- Filtering by context layer does not require full table scans

## Application-Level Considerations

### Creating Messages

When creating new messages, the application must explicitly set the `context_layer`:

```typescript
// Patient intake message (default)
await db.insert(chatMessages).values({
  sessionId: sessionId,
  role: 'user',
  content: patientMessage,
  contextLayer: 'patient-intake', // Immutable
});

// Doctor enhancement message
await db.insert(chatMessages).values({
  sessionId: sessionId,
  role: 'user',
  content: doctorNote,
  contextLayer: 'doctor-enhancement', // Editable
});
```

### Updating Messages

Only `doctor-enhancement` messages can be updated:

```typescript
// This will succeed
await db.update(chatMessages)
  .set({ content: updatedContent })
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'doctor-enhancement')
  ));

// This will fail with database exception
await db.update(chatMessages)
  .set({ content: updatedContent })
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'patient-intake')
  ));
// Error: Cannot modify patient-intake messages. Patient intake data is immutable.
```

### Deleting Messages

Only `doctor-enhancement` messages can be deleted:

```typescript
// This will succeed
await db.delete(chatMessages)
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'doctor-enhancement')
  ));

// This will fail with database exception
await db.delete(chatMessages)
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'patient-intake')
  ));
// Error: Cannot delete patient-intake messages. Patient intake data is immutable.
```

### Cascade Deletes

**Important**: When an `intake_session` is deleted, the foreign key constraint will attempt to cascade delete all associated `chat_messages`. This includes `patient-intake` messages, which will fail due to the immutability triggers.

**Recommendation**: 
- Do not delete intake sessions that contain patient-intake messages
- Instead, mark sessions as archived or inactive
- If deletion is necessary, first verify no patient-intake messages exist, or handle the exception appropriately

## UI Implications

### Doctor Interface

In the doctor's immersive interface:

1. **Patient-intake messages** are displayed with:
   - Read-only styling (gray background)
   - No edit or delete buttons
   - Visual indicator showing "Patient Intake" context

2. **Doctor-enhancement messages** are displayed with:
   - Editable styling (purple background)
   - Edit and delete buttons available
   - Visual indicator showing "Doctor Note" context

### Message Differentiation

The UI must clearly distinguish between the two context layers:

```typescript
function MessageBubble({ message }: { message: ChatMessage }) {
  const isPatientIntake = message.contextLayer === 'patient-intake';
  
  return (
    <div className={cn(
      'message-bubble',
      isPatientIntake ? 'bg-gray-100 text-gray-900' : 'bg-purple-600 text-white'
    )}>
      <div className="message-content">{message.content}</div>
      <div className="message-meta">
        {isPatientIntake ? (
          <Badge variant="secondary">Patient Intake</Badge>
        ) : (
          <Badge variant="default">Doctor Note</Badge>
        )}
        {!isPatientIntake && (
          <div className="message-actions">
            <Button size="sm" onClick={() => editMessage(message.id)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => deleteMessage(message.id)}>Delete</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Testing Immutability

### Unit Tests

Test that the database triggers work correctly:

```typescript
describe('Patient Intake Immutability', () => {
  it('should prevent updating patient-intake messages', async () => {
    const message = await createPatientIntakeMessage();
    
    await expect(
      db.update(chatMessages)
        .set({ content: 'Modified content' })
        .where(eq(chatMessages.id, message.id))
    ).rejects.toThrow('Cannot modify patient-intake messages');
  });
  
  it('should prevent deleting patient-intake messages', async () => {
    const message = await createPatientIntakeMessage();
    
    await expect(
      db.delete(chatMessages)
        .where(eq(chatMessages.id, message.id))
    ).rejects.toThrow('Cannot delete patient-intake messages');
  });
  
  it('should allow updating doctor-enhancement messages', async () => {
    const message = await createDoctorEnhancementMessage();
    
    await expect(
      db.update(chatMessages)
        .set({ content: 'Modified content' })
        .where(eq(chatMessages.id, message.id))
    ).resolves.not.toThrow();
  });
  
  it('should allow deleting doctor-enhancement messages', async () => {
    const message = await createDoctorEnhancementMessage();
    
    await expect(
      db.delete(chatMessages)
        .where(eq(chatMessages.id, message.id))
    ).resolves.not.toThrow();
  });
});
```

### Property-Based Tests

Test the immutability property across all patient-intake messages:

```typescript
import fc from 'fast-check';

describe('Property: Patient Intake Immutability', () => {
  it('should prevent modification of any patient-intake message', () => {
    fc.assert(
      fc.property(
        fc.string(), // message content
        async (content) => {
          const message = await createPatientIntakeMessage({ content });
          
          // Attempt to update should always fail
          await expect(
            db.update(chatMessages)
              .set({ content: 'Modified' })
              .where(eq(chatMessages.id, message.id))
          ).rejects.toThrow('Cannot modify patient-intake messages');
          
          // Verify content unchanged
          const retrieved = await db.query.chatMessages.findFirst({
            where: eq(chatMessages.id, message.id)
          });
          expect(retrieved?.content).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Rationale

### Why Database-Level Enforcement?

1. **Defense in Depth**: Application bugs cannot violate immutability
2. **Direct Database Access**: Protects against manual SQL queries
3. **Third-Party Tools**: Database admin tools cannot accidentally modify data
4. **Audit Compliance**: Demonstrates technical controls for regulatory requirements
5. **Data Integrity**: Guarantees that patient testimony is never altered

### Why Not Application-Level Only?

Application-level checks are insufficient because:
- Bugs in the application code could bypass checks
- Direct database access (admin tools, scripts) would not be protected
- Future developers might not be aware of the constraint
- Regulatory compliance requires technical controls, not just policy

### Why Triggers Instead of CHECK Constraints?

PostgreSQL CHECK constraints cannot prevent UPDATE or DELETE operations based on existing column values. Triggers are the appropriate mechanism for this type of constraint.

## Compliance and Audit

### Medical-Legal Protection

Immutable patient intake messages provide:
- **Evidence Preservation**: Patient's original statements cannot be altered
- **Audit Trail**: Clear separation between patient-reported and doctor-observed data
- **Legal Defense**: Demonstrates technical controls to prevent data tampering
- **Regulatory Compliance**: Meets requirements for data integrity in medical records

### Audit Logging

Consider adding audit logging to track attempts to modify patient-intake messages:

```sql
CREATE TABLE audit_immutability_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  attempted_operation TEXT NOT NULL, -- 'UPDATE' or 'DELETE'
  attempted_by TEXT, -- User/session info if available
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  error_message TEXT NOT NULL
);

-- Modify trigger functions to log violations
CREATE OR REPLACE FUNCTION prevent_patient_intake_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.context_layer = 'patient-intake' THEN
    INSERT INTO audit_immutability_violations (message_id, attempted_operation, error_message)
    VALUES (OLD.id, 'UPDATE', 'Cannot modify patient-intake messages. Patient intake data is immutable.');
    
    RAISE EXCEPTION 'Cannot modify patient-intake messages. Patient intake data is immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Summary

The patient intake immutability system provides:

✅ **Database-level enforcement** via PostgreSQL triggers  
✅ **Efficient querying** via specialized indexes  
✅ **Clear error messages** for violation attempts  
✅ **UI differentiation** between immutable and editable messages  
✅ **Medical-legal protection** through technical controls  
✅ **Audit compliance** with immutable patient testimony  

This design ensures that the patient's original intake conversation remains pristine while allowing doctors to build upon it with clinical data, maintaining both data integrity and clinical utility.
