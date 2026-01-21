# Task 2.2 Implementation Summary: Create Message Mutation Endpoints

## Overview
Successfully implemented two new tRPC mutation endpoints in the intake router to enable doctors to add test results, exam findings, and notes to patient intake sessions. These mutations maintain strict separation between patient intake data and doctor enhancements while triggering SBAR regeneration.

## Endpoints Implemented

### 1. `addMessage` - Add doctor text message
**Location:** `src/server/api/routers/intake.ts` (line ~2540)

**Purpose:** Allow doctors to add text messages (notes, test results, exam findings) to intake sessions with proper context layer separation.

**Input:**
```typescript
{
  connectionId: string (UUID);
  content: string (min 1 char);
  messageType: 'text' | 'test-result' | 'exam-finding' (default: 'text');
  metadata?: Record<string, any>;
}
```

**Output:**
```typescript
{
  message: Message; // The created message with contextLayer: 'doctor-enhancement'
  sbar: SBAR;       // Regenerated SBAR using both context layers
}
```

**Authorization:**
- Doctor in the connection ✓ (doctorProcedure)
- Patient ✗ (doctor-only mutation)
- Super admin ✗ (doctor-only mutation)

**Key Features:**
- Creates message with `contextLayer: 'doctor-enhancement'`
- Never modifies patient-intake messages (read-only)
- Aggregates all doctor enhancements into `medicalData.doctorNotes`
- Triggers SBAR regeneration using both patient-intake and doctor-enhancement messages
- Supports three message types: text, test-result, exam-finding
- Logs audit trail with 'message_sent' action

**Requirements Satisfied:** 2.3, 2.6, 5.5, 5.6

---

### 2. `addImageMessage` - Add doctor image message
**Location:** `src/server/api/routers/intake.ts` (line ~2670)

**Purpose:** Allow doctors to upload images (test results, scans, x-rays) to intake sessions with proper context layer separation.

**Input:**
```typescript
{
  connectionId: string (UUID);
  imageUrl: string (URL);
  messageType: 'image' | 'test-result' (default: 'image');
  caption?: string;
}
```

**Output:**
```typescript
{
  message: Message; // The created message with image and contextLayer: 'doctor-enhancement'
  sbar: SBAR;       // Regenerated SBAR using both context layers
}
```

**Authorization:**
- Doctor in the connection ✓ (doctorProcedure)
- Patient ✗ (doctor-only mutation)
- Super admin ✗ (doctor-only mutation)

**Key Features:**
- Creates message with `contextLayer: 'doctor-enhancement'`
- Stores image URL in message.images array
- Never modifies patient-intake messages (read-only)
- Aggregates all doctor enhancements (including images) into `medicalData.doctorNotes`
- Triggers SBAR regeneration using both patient-intake and doctor-enhancement messages
- Supports two message types: image, test-result
- Logs audit trail with 'message_sent' action

**Requirements Satisfied:** 2.3, 2.4, 5.5, 5.6

---

## Implementation Details

### Context Layer Separation
Both mutations implement strict context layer separation:

1. **Patient Intake Layer (`patient-intake`):**
   - Original patient messages from intake conversation
   - Read-only in doctor view
   - Never modified by doctor mutations
   - Used as base context for SBAR generation

2. **Doctor Enhancement Layer (`doctor-enhancement`):**
   - Doctor-added test results, exam findings, notes, images
   - Editable by doctor
   - Stored separately from patient intake
   - Merged with patient context for SBAR generation

### SBAR Regeneration Flow

```typescript
// 1. Create doctor message with contextLayer: 'doctor-enhancement'
await db.insert(chatMessages).values({
  contextLayer: 'doctor-enhancement',
  role: 'doctor',
  content: input.content,
  // ...
});

// 2. Fetch ALL messages (both context layers)
const allMessages = await db.query.chatMessages.findMany({
  where: eq(chatMessages.sessionId, session.id),
});

// 3. Aggregate doctor enhancements
const doctorEnhancements = allMessages
  .filter(msg => msg.contextLayer === 'doctor-enhancement')
  .map(msg => msg.content)
  .join('\n\n');

// 4. Merge into medical data
currentMedicalData = {
  ...currentMedicalData,
  doctorNotes: doctorEnhancements, // New field for doctor context
};

// 5. Regenerate SBAR using both layers
const clinicalHandover = await generateClinicalHandover(currentMedicalData);

// 6. Update session with new SBAR
await db.update(intakeSessions).set({ clinicalHandover });
```

### Authorization Pattern
Both endpoints use `doctorProcedure` which:
1. Verifies user is authenticated
2. Verifies user has a doctor profile
3. Verifies doctor owns the connection
4. Rejects if any check fails

### Error Handling
- `UNAUTHORIZED` (401): User is not a doctor
- `NOT_FOUND` (404): Connection or session doesn't exist
- `INTERNAL_SERVER_ERROR` (500): Database operation failed

### Audit Logging
Both mutations log to the audit trail:
- Action: `message_sent`
- Resource Type: `message`
- Metadata includes: connectionId, sessionId, messageType, contextLayer

---

## Type System Updates

### MedicalData Interface
Added new optional field to support doctor enhancements:

```typescript
export interface MedicalData {
  // ... existing fields ...
  doctorNotes?: string; // Doctor enhancements (test results, exam findings, notes)
}
```

**Location:** `src/types/index.ts` (line ~80)

This field aggregates all doctor-enhancement messages for SBAR generation without modifying the patient's original intake data.

---

## Testing

### Unit Tests Created
**File:** `__tests__/unit/intake-router-endpoints.test.ts`

**New Test Coverage:**
- ✓ addMessage input validation (UUID, content, messageType)
- ✓ addMessage response structure (message + SBAR)
- ✓ addMessage contextLayer verification (doctor-enhancement)
- ✓ addMessage message type support (text, test-result, exam-finding)
- ✓ addMessage authorization (doctor-only)
- ✓ addImageMessage input validation (UUID, URL, messageType)
- ✓ addImageMessage response structure (message with image + SBAR)
- ✓ addImageMessage contextLayer verification (doctor-enhancement)
- ✓ addImageMessage message type support (image, test-result)
- ✓ addImageMessage authorization (doctor-only)
- ✓ SBAR regeneration trigger verification
- ✓ Both context layers used for SBAR generation
- ✓ Patient intake immutability verification

**Test Results:** All 22 tests passing ✓

---

## Database Schema Support

The implementation leverages existing database schema:
- `chatMessages` table: Contains `contextLayer` enum field (added in task 1.1)
- `intakeSessions` table: Contains `clinicalHandover` JSONB field for SBAR
- `connections` table: Links patients and doctors
- Proper indexes exist for efficient querying by contextLayer

---

## Integration with Existing Code

### Imports Used
```typescript
import { generateClinicalHandover } from '../../services/ai';
import { auditService } from '../../services/audit';
import type { Message, MedicalData, SBAR, ContextLayer } from '@/types';
```

### Router Registration
The intake router is already registered in `src/server/api/root.ts` as:
```typescript
intake: intakeRouter
```

### Existing Endpoints Preserved
All existing endpoints remain unchanged and functional:
- `getSession` - Fetch full session with messages
- `getMessages` - Fetch messages by connectionId (task 2.1)
- `getSBAR` - Fetch latest SBAR (task 2.1)
- `getClinicalReasoning` - Fetch clinical reasoning (task 2.1)
- `markAsReviewed` - Mark session as reviewed
- All other existing endpoints

---

## Key Design Decisions

### 1. Context Layer Separation
**Decision:** Store doctor messages with `contextLayer: 'doctor-enhancement'` separate from patient intake.

**Rationale:**
- Maintains data integrity of patient's original intake conversation
- Enables clear audit trail of who added what information
- Allows UI to visually distinguish patient vs doctor messages
- Supports future features like editing/deleting doctor notes without affecting patient data

### 2. SBAR Regeneration on Every Message
**Decision:** Regenerate SBAR immediately after each doctor message.

**Rationale:**
- Ensures SBAR always reflects latest clinical information
- Provides real-time clinical decision support
- Aligns with requirement 2.6 (trigger SBAR regeneration)
- Acceptable performance impact (SBAR generation is async)

### 3. Aggregate Doctor Notes in MedicalData
**Decision:** Add `doctorNotes` field to MedicalData for SBAR generation.

**Rationale:**
- Provides clean interface for SBAR generation service
- Avoids modifying existing medical data fields
- Keeps doctor enhancements separate but accessible
- Enables future features like structured doctor note parsing

### 4. Return Both Message and SBAR
**Decision:** Both mutations return the created message AND the regenerated SBAR.

**Rationale:**
- Enables optimistic UI updates (show message immediately)
- Provides updated SBAR without additional query
- Reduces network round-trips for better UX
- Aligns with real-time update requirements

---

## Next Steps (Task 2.3)

The next task will implement session management endpoints:
- `markReviewed` mutation - Mark intake session as reviewed by doctor
- `getUCGRecommendations` query - Fetch Uganda Clinical Guidelines recommendations
- Additional session status management features

---

## Requirements Traceability

| Requirement | Implementation | Status |
|------------|----------------|--------|
| 2.3 - Doctor can submit messages | addMessage mutation | ✓ Complete |
| 2.6 - Display message timestamps | Message includes timestamp | ✓ Complete |
| 5.5 - Store in doctor enhancement layer | contextLayer: 'doctor-enhancement' | ✓ Complete |
| 5.6 - Trigger SBAR regeneration | generateClinicalHandover called | ✓ Complete |
| 2.4 - Support image uploads | addImageMessage mutation | ✓ Complete |

---

## Files Modified

1. **src/server/api/routers/intake.ts**
   - Added `addMessage` mutation (~130 lines)
   - Added `addImageMessage` mutation (~130 lines)
   - Total: ~260 lines of new code

2. **src/types/index.ts**
   - Added `doctorNotes?: string` to MedicalData interface
   - Total: 1 line added

3. **__tests__/unit/intake-router-endpoints.test.ts**
   - Added 11 new test cases for mutations
   - Added SBAR regeneration tests
   - Added patient intake immutability tests
   - Total: ~180 lines of test code

---

## Verification

✓ TypeScript compilation successful (no diagnostics)
✓ All unit tests passing (22/22)
✓ Authorization checks implemented correctly
✓ Context layer separation working as expected
✓ SBAR regeneration triggered correctly
✓ Patient intake immutability maintained
✓ Audit logging implemented
✓ Type safety maintained throughout

---

## Notes

- The implementation maintains strict separation between patient intake and doctor enhancements
- Patient intake messages are never modified by doctor mutations (read-only)
- SBAR regeneration uses both context layers for comprehensive clinical reasoning
- Both mutations are doctor-only (doctorProcedure) for security
- Audit trail logs all doctor message additions
- The implementation is ready for integration with the frontend doctor intake interface
- Future enhancements could include:
  - Editing/deleting doctor enhancement messages
  - Structured test result parsing
  - Image analysis integration
  - Real-time collaboration features

