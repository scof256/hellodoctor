# Database Documentation

This directory contains documentation for database-level features and constraints in the medical intake system.

## Contents

### [Patient Intake Immutability](./patient-intake-immutability.md)

Comprehensive documentation on the immutability guarantees for patient intake messages, including:
- Design principles and rationale
- Database-level enforcement via triggers
- Application-level considerations
- UI implications
- Testing strategies
- Compliance and audit considerations

**Key Points:**
- Patient intake messages (`contextLayer='patient-intake'`) are immutable
- Database triggers prevent UPDATE and DELETE operations
- Doctor enhancement messages (`contextLayer='doctor-enhancement'`) are editable
- Ensures data integrity and medical-legal protection

### [Context Layer Indexes](./context-layer-indexes.md)

Detailed analysis of database indexes supporting efficient querying by context layer, including:
- Index strategy and design
- Query patterns and performance
- Index sufficiency analysis
- Performance benchmarks
- Maintenance considerations

**Key Points:**
- Four indexes support efficient querying
- Covers all common query patterns
- Optimal for real-time polling
- Balanced read/write trade-offs

## Related Migrations

- **0011_add-context-layer.sql**: Adds `contextLayer` field and indexes
- **0012_patient-intake-immutability.sql**: Adds immutability triggers and constraints

## Related Tests

- **__tests__/database/patient-intake-immutability.test.ts**: Unit tests for immutability constraints

## Quick Reference

### Context Layer Values

| Value | Description | Mutability |
|-------|-------------|------------|
| `patient-intake` | Original patient intake messages | **Immutable** (cannot update or delete) |
| `doctor-enhancement` | Doctor-added test results, exam findings, notes | **Mutable** (can update and delete) |

### Database Triggers

| Trigger | Function | Purpose |
|---------|----------|---------|
| `prevent_patient_intake_update` | `prevent_patient_intake_modification()` | Prevents UPDATE on patient-intake messages |
| `prevent_patient_intake_delete` | `prevent_patient_intake_deletion()` | Prevents DELETE on patient-intake messages |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `chat_messages_context_layer_idx` | `context_layer` | Filter by context layer |
| `chat_messages_session_context_idx` | `session_id, context_layer` | Filter by session and context layer |
| `chat_messages_session_created_idx` | `session_id, created_at` | Chronological ordering within session |
| `chat_messages_session_id_idx` | `session_id` | Foreign key and session filtering |

## Usage Examples

### Creating Messages

```typescript
// Patient intake message (immutable)
await db.insert(chatMessages).values({
  sessionId: sessionId,
  role: 'user',
  content: 'I have a headache',
  contextLayer: 'patient-intake', // Will be immutable
});

// Doctor enhancement message (mutable)
await db.insert(chatMessages).values({
  sessionId: sessionId,
  role: 'user',
  content: 'Blood pressure: 120/80',
  contextLayer: 'doctor-enhancement', // Can be edited
});
```

### Querying Messages

```typescript
// Get all patient-intake messages for a session
const patientMessages = await db.query.chatMessages.findMany({
  where: and(
    eq(chatMessages.sessionId, sessionId),
    eq(chatMessages.contextLayer, 'patient-intake')
  ),
  orderBy: [asc(chatMessages.createdAt)],
});

// Get all doctor-enhancement messages for a session
const doctorMessages = await db.query.chatMessages.findMany({
  where: and(
    eq(chatMessages.sessionId, sessionId),
    eq(chatMessages.contextLayer, 'doctor-enhancement')
  ),
  orderBy: [asc(chatMessages.createdAt)],
});
```

### Updating Messages

```typescript
// This will FAIL - patient-intake messages are immutable
await db.update(chatMessages)
  .set({ content: 'Modified content' })
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'patient-intake')
  ));
// Error: Cannot modify patient-intake messages. Patient intake data is immutable.

// This will SUCCEED - doctor-enhancement messages are mutable
await db.update(chatMessages)
  .set({ content: 'Blood pressure: 130/85' })
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'doctor-enhancement')
  ));
```

### Deleting Messages

```typescript
// This will FAIL - patient-intake messages are immutable
await db.delete(chatMessages)
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'patient-intake')
  ));
// Error: Cannot delete patient-intake messages. Patient intake data is immutable.

// This will SUCCEED - doctor-enhancement messages are mutable
await db.delete(chatMessages)
  .where(and(
    eq(chatMessages.id, messageId),
    eq(chatMessages.contextLayer, 'doctor-enhancement')
  ));
```

## Important Considerations

### Cascade Deletes

When deleting an `intake_session`, the foreign key constraint will attempt to cascade delete all associated `chat_messages`. This includes `patient-intake` messages, which will **fail** due to the immutability triggers.

**Recommendation:**
- Do not delete intake sessions that contain patient-intake messages
- Instead, mark sessions as archived or inactive
- If deletion is necessary, handle the exception appropriately

### Session Cleanup

For test environments or data cleanup, you may need to:
1. Delete all doctor-enhancement messages first
2. Then handle patient-intake messages separately (or accept that sessions with patient-intake messages cannot be deleted)

### Performance Monitoring

Monitor index usage in production:

```sql
-- Check index usage statistics
SELECT 
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'chat_messages'
ORDER BY idx_scan DESC;
```

## Requirements Traceability

This implementation satisfies the following requirements from the doctor-intake-immersive-interface spec:

- **Requirement 2.2**: Patient intake messages are read-only (contextLayer: 'patient-intake')
- **Requirement 2.9**: Visual distinction between patient intake and doctor enhancement messages
- **Requirement 5.5**: Test results and exam findings stored in doctor enhancement context layer
- **Requirement 5.8**: Patient intake messages never modified when doctor enhancements added

## See Also

- [Doctor Intake Immersive Interface Requirements](../../.kiro/specs/doctor-intake-immersive-interface/requirements.md)
- [Doctor Intake Immersive Interface Design](../../.kiro/specs/doctor-intake-immersive-interface/design.md)
- [Database Schema](../../src/server/db/schema.ts)
