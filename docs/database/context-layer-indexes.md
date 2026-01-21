# Context Layer Indexes

## Overview

This document describes the database indexes created to support efficient querying of messages by context layer in the doctor intake immersive interface.

## Requirements

The doctor intake interface needs to:
1. Fetch all patient-intake messages for a session (read-only display)
2. Fetch all doctor-enhancement messages for a session (editable display)
3. Display messages in chronological order
4. Filter messages by context layer efficiently
5. Support real-time polling for new messages

## Index Strategy

### 1. Single-Column Index: `chat_messages_context_layer_idx`

**Definition:**
```sql
CREATE INDEX IF NOT EXISTS "chat_messages_context_layer_idx" 
ON "chat_messages" USING btree ("context_layer");
```

**Purpose:**
- Supports queries filtering by context layer alone
- Useful for global queries across all sessions

**Example Queries:**
```sql
-- Get all patient-intake messages (across all sessions)
SELECT * FROM chat_messages WHERE context_layer = 'patient-intake';

-- Count doctor-enhancement messages
SELECT COUNT(*) FROM chat_messages WHERE context_layer = 'doctor-enhancement';
```

**Performance:**
- Index scan instead of sequential scan
- O(log n) lookup time
- Efficient for selectivity when context layer is the primary filter

### 2. Composite Index: `chat_messages_session_context_idx`

**Definition:**
```sql
CREATE INDEX IF NOT EXISTS "chat_messages_session_context_idx" 
ON "chat_messages" USING btree ("session_id", "context_layer");
```

**Purpose:**
- Supports queries filtering by both session and context layer
- Most common query pattern in the doctor interface

**Example Queries:**
```sql
-- Get all patient-intake messages for a specific session
SELECT * FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000' 
  AND context_layer = 'patient-intake';

-- Get all doctor-enhancement messages for a specific session
SELECT * FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000' 
  AND context_layer = 'doctor-enhancement';
```

**Performance:**
- Index-only scan for covered queries
- O(log n) lookup time for session + context layer
- Optimal for the most common query pattern

**Index Column Order:**
The order `(session_id, context_layer)` is optimal because:
1. `session_id` is more selective (fewer messages per session than per context layer)
2. Queries always filter by session first, then optionally by context layer
3. Supports prefix matching (can use index for session_id alone)

### 3. Composite Index: `chat_messages_session_created_idx`

**Definition:**
```sql
CREATE INDEX IF NOT EXISTS "chat_messages_session_created_idx" 
ON "chat_messages" USING btree ("session_id", "created_at");
```

**Purpose:**
- Supports chronological ordering of messages within a session
- Works efficiently with context layer filtering

**Example Queries:**
```sql
-- Get all messages for a session in chronological order
SELECT * FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000' 
ORDER BY created_at ASC;

-- Get recent messages for a session
SELECT * FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000' 
  AND created_at > '2024-01-01 00:00:00'
ORDER BY created_at DESC;
```

**Performance:**
- Index scan with ordering
- No additional sort operation needed
- Efficient for pagination and real-time updates

### 4. Primary Index: `chat_messages_session_id_idx`

**Definition:**
```sql
CREATE INDEX IF NOT EXISTS "chat_messages_session_id_idx" 
ON "chat_messages" USING btree ("session_id");
```

**Purpose:**
- Supports foreign key constraint
- Supports queries filtering by session alone

**Example Queries:**
```sql
-- Get all messages for a session (any context layer)
SELECT * FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000';

-- Count messages in a session
SELECT COUNT(*) FROM chat_messages 
WHERE session_id = '123e4567-e89b-12d3-a456-426614174000';
```

## Query Patterns and Index Usage

### Pattern 1: Fetch All Messages for Session (Mixed Context)

**Query:**
```sql
SELECT * FROM chat_messages 
WHERE session_id = ? 
ORDER BY created_at ASC;
```

**Index Used:** `chat_messages_session_created_idx`
- Index scan on (session_id, created_at)
- No additional sort needed
- Optimal performance

### Pattern 2: Fetch Patient-Intake Messages Only

**Query:**
```sql
SELECT * FROM chat_messages 
WHERE session_id = ? 
  AND context_layer = 'patient-intake'
ORDER BY created_at ASC;
```

**Index Used:** `chat_messages_session_context_idx` (primary) + `chat_messages_session_created_idx` (for ordering)
- Index scan on (session_id, context_layer)
- Additional sort on created_at (small dataset, fast)
- Good performance

**Alternative (if ordering is critical):**
Could create a specialized index `(session_id, context_layer, created_at)` but this is likely overkill given the small number of messages per session.

### Pattern 3: Fetch Doctor-Enhancement Messages Only

**Query:**
```sql
SELECT * FROM chat_messages 
WHERE session_id = ? 
  AND context_layer = 'doctor-enhancement'
ORDER BY created_at ASC;
```

**Index Used:** Same as Pattern 2
- Index scan on (session_id, context_layer)
- Additional sort on created_at
- Good performance

### Pattern 4: Real-Time Polling for New Messages

**Query:**
```sql
SELECT * FROM chat_messages 
WHERE session_id = ? 
  AND created_at > ?
ORDER BY created_at ASC;
```

**Index Used:** `chat_messages_session_created_idx`
- Index range scan on (session_id, created_at)
- Efficient for incremental updates
- Optimal for polling

### Pattern 5: Count Messages by Context Layer

**Query:**
```sql
SELECT context_layer, COUNT(*) 
FROM chat_messages 
WHERE session_id = ?
GROUP BY context_layer;
```

**Index Used:** `chat_messages_session_context_idx`
- Index-only scan (if possible)
- Efficient grouping
- Good performance

## Index Sufficiency Analysis

### Are the Current Indexes Sufficient?

**Yes**, the current indexes are sufficient for the following reasons:

1. **Coverage of Common Queries:**
   - All common query patterns are covered by existing indexes
   - No full table scans required for typical operations

2. **Optimal Performance:**
   - Index scans instead of sequential scans
   - Minimal sort operations needed
   - Efficient for real-time polling

3. **Balanced Trade-offs:**
   - Not over-indexed (which would slow down writes)
   - Covers the most selective query patterns
   - Supports both filtering and ordering efficiently

4. **Scalability:**
   - Indexes scale logarithmically with data size
   - Efficient even with millions of messages
   - Supports concurrent access patterns

### Potential Additional Indexes (Not Recommended)

**Option 1: `(session_id, context_layer, created_at)`**
- Would eliminate sort for Pattern 2 and 3
- But: Adds write overhead for minimal read benefit
- Verdict: **Not needed** - current indexes are sufficient

**Option 2: `(context_layer, session_id)`**
- Would support queries filtering by context layer first
- But: This query pattern is rare in the application
- Verdict: **Not needed** - not a common query pattern

**Option 3: `(created_at, session_id)`**
- Would support global chronological queries
- But: This query pattern doesn't exist in the application
- Verdict: **Not needed** - not a use case

## Performance Benchmarks

### Expected Performance (Estimated)

Assuming:
- 1,000,000 total messages in database
- 100 messages per session on average
- 50/50 split between patient-intake and doctor-enhancement

**Query 1: Fetch all messages for session**
- Without index: ~1000ms (full table scan)
- With index: ~5ms (index scan + 100 rows)
- **Improvement: 200x faster**

**Query 2: Fetch patient-intake messages for session**
- Without index: ~1000ms (full table scan + filter)
- With index: ~3ms (index scan + 50 rows)
- **Improvement: 333x faster**

**Query 3: Fetch new messages since timestamp**
- Without index: ~1000ms (full table scan + filter + sort)
- With index: ~2ms (index range scan + few rows)
- **Improvement: 500x faster**

### Monitoring Index Usage

To verify index usage in production:

```sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'chat_messages'
ORDER BY idx_scan DESC;

-- Check for unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'chat_messages'
  AND idx_scan = 0
  AND indexname NOT LIKE '%pkey%';
```

## Maintenance Considerations

### Index Bloat

Over time, indexes can become bloated due to updates and deletes. Monitor and rebuild if necessary:

```sql
-- Check index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'chat_messages'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild index if bloated (rarely needed)
REINDEX INDEX CONCURRENTLY chat_messages_session_context_idx;
```

### Write Performance Impact

Each index adds overhead to INSERT, UPDATE, and DELETE operations:

- **INSERT**: All 4 indexes must be updated (~4x overhead)
- **UPDATE**: Only affected indexes updated (depends on columns changed)
- **DELETE**: All 4 indexes must be updated (~4x overhead)

For the chat_messages table:
- Inserts are frequent (new messages)
- Updates are rare (only doctor-enhancement messages)
- Deletes are rare (only doctor-enhancement messages)

**Verdict:** The write overhead is acceptable given the read performance benefits.

## Summary

The current index strategy provides:

✅ **Efficient querying** by context layer  
✅ **Fast chronological ordering** within sessions  
✅ **Optimal real-time polling** performance  
✅ **Balanced read/write trade-offs**  
✅ **Scalable** to millions of messages  

**No additional indexes are needed** at this time. The current indexes are sufficient for all anticipated query patterns in the doctor intake immersive interface.

## References

- Migration: `0011_add-context-layer.sql`
- Schema: `src/server/db/schema.ts`
- Requirements: `.kiro/specs/doctor-intake-immersive-interface/requirements.md` (5.5, 5.8)
