# Patient-Doctor System Architecture

This document explains how the patient-doctor system works, how components connect, and identifies potential issues.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PATIENT-DOCTOR FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. DISCOVERY          2. CONNECTION         3. INTAKE           4. CARE   │
│  ───────────           ──────────────        ─────────           ────────  │
│                                                                             │
│  Patient scans    →    Patient connects  →   AI-powered      →  Messaging  │
│  QR code or            to verified           medical intake      Booking   │
│  visits URL            doctor                                    Appts     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. User Authentication & Roles

### Authentication Flow
```
Clerk Auth → Webhook → users table → Role Assignment → Dashboard Redirect
```

### Role Hierarchy
| Role | Access Level | Description |
|------|--------------|-------------|
| `super_admin` | Full | Platform-wide admin, bypasses all checks |
| `doctor` | High | Doctor dashboard, patient management |
| `clinic_admin` | Medium | Clinic management, can message on behalf of doctor |
| `receptionist` | Medium | Appointment scheduling |
| `patient` | Standard | Patient dashboard, intake, messaging |

### Key Files
- `middleware.ts` - Route protection, CSRF validation
- `src/server/api/trpc.ts` - Procedure types with role enforcement
- `app/api/auth/webhook/route.ts` - Clerk webhook for user sync
- `app/(auth)/onboarding/page.tsx` - Role selection after signup

### Procedure Types
```typescript
publicProcedure      // No auth required (doctor profile lookup)
protectedProcedure   // Auth required
patientProcedure     // Auth + patient profile loaded
doctorProcedure      // Auth + doctor role + doctor profile loaded
adminProcedure       // Auth + super_admin role
```

---

## 2. Connection Flow (Patient → Doctor)

### How It Works
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Patient    │     │  /connect/   │     │  connection  │     │   Doctor     │
│  scans QR    │ ──► │   [slug]     │ ──► │   .create()  │ ──► │  notified    │
│              │     │   page       │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Auto-create  │
                     │ patient if   │
                     │ not exists   │
                     └──────────────┘
```

### Database Tables
```sql
-- connections table
id              UUID PRIMARY KEY
patient_id      UUID → patients.id
doctor_id       UUID → doctors.id
status          ENUM('active', 'disconnected', 'blocked')
connection_source TEXT ('qr_scan', 'direct_url', 'referral')
connected_at    TIMESTAMP
```

### Key Files
- `app/(public)/connect/[slug]/page.tsx` - Public doctor profile
- `src/server/api/routers/connection.ts` - Connection CRUD
- `src/server/services/qr.ts` - QR code generation
- `app/api/auth/auto-patient/route.ts` - Auto-create patient profile

### Connection Rules
1. Doctor must be **verified** before patients can connect
2. **Unique constraint** on (patient_id, doctor_id) - no duplicates
3. If disconnected, **reactivates** existing connection instead of creating new
4. Tracks **connection source** (qr_scan, direct_url, referral)

### Potential Issues
- ⚠️ Race condition: Patient profile might not exist when connecting (auto-patient API should handle)
- ⚠️ Unverified doctors can't accept connections - patients see error

---

## 3. Intake Process (AI-Powered Medical History)

### Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Patient    │     │   intake     │     │   Gemini     │     │   Doctor     │
│  starts      │ ──► │   .create()  │ ──► │   AI chat    │ ──► │  reviews     │
│  intake      │     │              │     │              │     │  SBAR        │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │ Session      │     │ Medical data │
                     │ created      │     │ extracted    │
                     └──────────────┘     └──────────────┘
```

### Database Tables
```sql
-- intake_sessions table
id              UUID PRIMARY KEY
connection_id   UUID → connections.id
status          ENUM('not_started', 'in_progress', 'ready', 'reviewed')
medical_data    JSONB (symptoms, history, medications, etc.)
clinical_handover JSONB (SBAR format for doctor)
completeness    INTEGER (0-100%)
current_agent   TEXT ('Triage', 'History', etc.)

-- chat_messages table
id              UUID PRIMARY KEY
session_id      UUID → intake_sessions.id
role            TEXT ('user', 'assistant')
content         TEXT
images          JSONB (array of image URLs)
active_agent    TEXT
```

### Key Files
- `src/server/api/routers/intake.ts` - Intake session management
- `src/server/services/gemini.ts` - AI conversation handling
- `src/server/services/intake-utils.ts` - Completeness calculation, data merging
- `app/(dashboard)/patient/intake/[connectionId]/page.tsx` - Patient intake UI
- `app/(dashboard)/doctor/patients/[connectionId]/intake/page.tsx` - Doctor review UI

### Intake Status Progression
```
not_started → in_progress → ready → reviewed
     │              │           │         │
     │              │           │         └── Doctor marked as reviewed
     │              │           └── AI determined intake complete
     │              └── Patient started chatting
     └── Session created but no messages
```

### Medical Data Structure
```typescript
interface MedicalData {
  chiefComplaint?: string;
  symptoms?: string[];
  duration?: string;
  severity?: string;
  medicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  familyHistory?: string[];
  socialHistory?: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
  };
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
  };
}
```

### Potential Issues
- ⚠️ Patient profile must exist before creating intake (check `ctx.patient`)
- ⚠️ Connection must be active
- ⚠️ Only one active intake session per connection allowed
- ⚠️ AI extraction might miss data - completeness calculation may be inaccurate

---

## 4. Appointment Booking

### Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Patient    │     │  Get avail   │     │  appointment │     │   Both       │
│  selects     │ ──► │  slots for   │ ──► │   .create()  │ ──► │  notified    │
│  date        │     │  date        │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Database Tables
```sql
-- appointments table
id              UUID PRIMARY KEY
connection_id   UUID → connections.id
intake_session_id UUID → intake_sessions.id (optional)
scheduled_at    TIMESTAMP
duration        INTEGER (minutes)
status          ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show')
price           INTEGER (cents)
cancel_reason   TEXT

-- doctor_availability table
id              UUID PRIMARY KEY
doctor_id       UUID → doctors.id
day_of_week     INTEGER (0=Sunday, 6=Saturday)
start_time      TEXT ('09:00')
end_time        TEXT ('17:00')
is_active       BOOLEAN

-- doctor_blocked_dates table
id              UUID PRIMARY KEY
doctor_id       UUID → doctors.id
date            TIMESTAMP
reason          TEXT
```

### Key Files
- `src/server/api/routers/appointment.ts` - Appointment CRUD
- `src/server/api/routers/doctor.ts` - Availability management
- `app/(dashboard)/patient/appointments/page.tsx` - Patient booking UI
- `app/(dashboard)/doctor/appointments/page.tsx` - Doctor schedule UI
- `app/(dashboard)/doctor/availability/page.tsx` - Set weekly schedule

### Slot Generation Logic
```typescript
function getAvailableSlots(doctorId, date) {
  1. Get doctor's availability for day_of_week
  2. Check if date is blocked
  3. Generate time slots based on:
     - start_time, end_time
     - appointment_duration + buffer_time
  4. Filter out slots with existing appointments
  5. Filter out past times (if today)
  return availableSlots;
}
```

### Potential Issues
- ⚠️ Doctor must have availability set for the day of week
- ⚠️ Double-booking prevention relies on checking existing appointments
- ⚠️ Timezone handling - all times stored in UTC
- ⚠️ Doctor must be verified to accept appointments

---

## 5. Direct Messaging

### Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Sender     │     │   message    │     │  Recipient   │
│  sends       │ ──► │   .send()    │ ──► │  notified    │
│  message     │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Database Tables
```sql
-- direct_messages table
id              UUID PRIMARY KEY
connection_id   UUID → connections.id
sender_id       UUID → users.id
content         TEXT
is_read         BOOLEAN
read_at         TIMESTAMP
created_at      TIMESTAMP
```

### Key Files
- `src/server/api/routers/message.ts` - Message CRUD
- `app/(dashboard)/patient/messages/page.tsx` - Patient messages UI
- `app/(dashboard)/doctor/messages/page.tsx` - Doctor messages UI
- `app/components/DirectChatOverlay.tsx` - Chat overlay component

### Access Control
```typescript
// Only these users can message in a connection:
1. The patient in the connection
2. The doctor in the connection
3. Clinic admins associated with the doctor
```

### Potential Issues
- ⚠️ Connection must be active to send messages
- ⚠️ Access verification on every message operation
- ⚠️ Unread count calculation uses window functions (performance)

---

## 6. Notifications

### Notification Types
| Type | Trigger | Recipient |
|------|---------|-----------|
| `connection` | Patient connects/disconnects | Doctor |
| `appointment` | Booking/cancellation/reschedule | Both |
| `message` | New direct message | Recipient |
| `intake_complete` | Patient completes intake | Doctor |

### Key Files
- `src/server/services/notification.ts` - Notification creation
- `src/server/api/routers/notification.ts` - Notification queries

---

## 7. Database Schema Relationships

```
users
  │
  ├── doctors (1:1)
  │     ├── doctor_availability (1:N)
  │     ├── doctor_blocked_dates (1:N)
  │     └── connections (1:N as doctor)
  │
  └── patients (1:1)
        └── connections (1:N as patient)
              │
              ├── intake_sessions (1:N)
              │     └── chat_messages (1:N)
              │
              ├── appointments (1:N)
              │
              └── direct_messages (1:N)
```

---

## 8. Common Issues & Debugging

### Issue: Patient can't connect to doctor
```
Check:
1. Is doctor verified? (doctors.verification_status = 'verified')
2. Does patient profile exist? (patients table)
3. Is there an existing connection? (might be disconnected)
```

### Issue: Intake not working
```
Check:
1. Does patient profile exist? (ctx.patient in intake.create)
2. Is connection active? (connections.status = 'active')
3. Is there already an active session? (intake_sessions.status = 'in_progress')
4. Is Gemini API key configured? (GOOGLE_GENERATIVE_AI_API_KEY)
```

### Issue: Doctor not seeing patient chat updates
```
This was fixed by:
1. Adding cache invalidation for getDoctorIntakeSessions when patient sends message
2. Adding polling (refetchInterval) to doctor's intake view (10s) and patients list (30s)

The intake chat is AI-powered (patient ↔ Gemini AI), not direct patient-doctor chat.
For direct messaging, use the Messages feature (/doctor/messages).
```

### Issue: Doctor not receiving direct messages in real-time
```
Fixed by adding polling to messages pages:
- Doctor messages page: polls every 10s for conversations, 5s for active chat
- Patient messages page: polls every 10s for conversations, 5s for active chat
- Cache invalidation on message.send updates getConversations and getUnreadCount
```

### Issue: Doctor not seeing new appointments
```
Fixed by adding polling to appointments pages:
- Doctor appointments page: polls every 30s
- Patient appointments page: polls every 30s
- Cache invalidation on appointment.create updates getMyAppointments
- Notifications sent to doctor when patient books appointment
```

### Issue: Doctor can't navigate from appointment to patient's intake
```
Fixed by:
1. Added connectionId and intakeSessionId to AppointmentSummary type
2. Updated getMyAppointments to include these fields in the response
3. Doctor appointments page now has "Intake" button linking to /doctor/patients/[connectionId]/intake
4. Doctor can view the patient's AI intake chat directly from the appointment card
```

### Issue: Can't book appointment
```
Check:
1. Is doctor verified?
2. Does doctor have availability for that day?
3. Is the date blocked?
4. Is the slot already taken?
5. Is the time in the past?
```

### Issue: Messages not sending
```
Check:
1. Is connection active?
2. Does user have access to connection? (patient, doctor, or clinic_admin)
3. Is content non-empty?
```

---

## 9. API Endpoints Summary

### Patient APIs
| Endpoint | Description |
|----------|-------------|
| `patient.getMyProfile` | Get patient profile |
| `patient.updateProfile` | Update patient info |
| `connection.create` | Connect to doctor |
| `connection.getMyConnections` | List connected doctors |
| `intake.create` | Start intake session |
| `intake.sendMessage` | Send message in intake |
| `appointment.create` | Book appointment |
| `message.send` | Send direct message |

### Doctor APIs
| Endpoint | Description |
|----------|-------------|
| `doctor.getMyProfile` | Get doctor profile |
| `doctor.updateProfile` | Update doctor info |
| `doctor.setAvailability` | Set weekly schedule |
| `doctor.blockDate` | Block specific date |
| `doctor.regenerateQRCode` | Generate new QR |
| `intake.getDoctorIntakeSessions` | Get patient intakes |
| `intake.markAsReviewed` | Mark intake reviewed |
| `appointment.getMyAppointments` | Get appointments |
| `message.getConversations` | Get all conversations |

### Public APIs
| Endpoint | Description |
|----------|-------------|
| `doctor.getBySlug` | Get doctor public profile |
| `appointment.getAvailableSlots` | Get available slots |

---

## 10. Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# AI
GOOGLE_GENERATIVE_AI_API_KEY=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Superuser bypass
SUPERUSER_IDS=clerk_user_id_1,clerk_user_id_2
```

---

## 11. Key Verification Points

When debugging, verify these in order:

1. **User exists in DB** - Check `users` table has entry with matching `clerk_id`
2. **Role is correct** - Check `users.primary_role` matches expected role
3. **Profile exists** - Check `doctors` or `patients` table has entry
4. **Doctor is verified** - Check `doctors.verification_status = 'verified'`
5. **Connection exists and active** - Check `connections` table
6. **Session exists** - Check `intake_sessions` table for intake issues
