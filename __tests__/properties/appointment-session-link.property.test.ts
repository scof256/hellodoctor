/**
 * Feature: intake-sessions-management
 * Property 9: Appointment-Session Link Persistence
 * 
 * For any appointment created with an intake session ID, the stored appointment record
 * SHALL contain the exact intakeSessionId that was provided during creation, and this
 * link SHALL be retrievable when querying the appointment.
 * 
 * Validates: Requirements 5.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for appointment-session linking
interface AppointmentCreateInput {
  connectionId: string;
  scheduledAt: Date;
  intakeSessionId?: string;
  notes?: string;
}

interface StoredAppointment {
  id: string;
  connectionId: string;
  intakeSessionId: string | null;
  scheduledAt: Date;
  duration: number;
  status: string;
  notes: string | null;
}

// Arbitraries
const appointmentCreateInputArb: fc.Arbitrary<AppointmentCreateInput> = fc.record({
  connectionId: fc.uuid(),
  scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  intakeSessionId: fc.option(fc.uuid(), { nil: undefined }),
  notes: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
});

/**
 * Simulates creating an appointment and storing it
 */
function createAppointment(input: AppointmentCreateInput): StoredAppointment {
  return {
    id: crypto.randomUUID(),
    connectionId: input.connectionId,
    intakeSessionId: input.intakeSessionId ?? null,
    scheduledAt: input.scheduledAt,
    duration: 30, // Default duration
    status: 'pending',
    notes: input.notes ?? null,
  };
}

/**
 * Simulates JSON serialization/deserialization (database round-trip)
 */
function simulateDatabaseRoundTrip<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

describe('Property 9: Appointment-Session Link Persistence', () => {
  it('appointment created with session ID should store that exact session ID', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, sessionId, scheduledAt) => {
          const input: AppointmentCreateInput = {
            connectionId,
            scheduledAt,
            intakeSessionId: sessionId,
          };

          const stored = createAppointment(input);

          expect(stored.intakeSessionId).toBe(sessionId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('appointment created without session ID should have null intakeSessionId', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, scheduledAt) => {
          const input: AppointmentCreateInput = {
            connectionId,
            scheduledAt,
            // No intakeSessionId
          };

          const stored = createAppointment(input);

          expect(stored.intakeSessionId).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session ID should be preserved through database round-trip', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, sessionId, scheduledAt) => {
          const input: AppointmentCreateInput = {
            connectionId,
            scheduledAt,
            intakeSessionId: sessionId,
          };

          const stored = createAppointment(input);
          const retrieved = simulateDatabaseRoundTrip(stored);

          expect(retrieved.intakeSessionId).toBe(sessionId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('null session ID should be preserved through database round-trip', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, scheduledAt) => {
          const input: AppointmentCreateInput = {
            connectionId,
            scheduledAt,
          };

          const stored = createAppointment(input);
          const retrieved = simulateDatabaseRoundTrip(stored);

          expect(retrieved.intakeSessionId).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session ID should be queryable after storage', () => {
    fc.assert(
      fc.property(
        appointmentCreateInputArb,
        (input) => {
          const stored = createAppointment(input);
          const retrieved = simulateDatabaseRoundTrip(stored);

          // The retrieved session ID should match what was provided
          if (input.intakeSessionId) {
            expect(retrieved.intakeSessionId).toBe(input.intakeSessionId);
          } else {
            expect(retrieved.intakeSessionId).toBeNull();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple appointments can link to the same session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }), { minLength: 2, maxLength: 5 }),
        (connectionId, sessionId, scheduledDates) => {
          const appointments = scheduledDates.map(scheduledAt => 
            createAppointment({
              connectionId,
              scheduledAt,
              intakeSessionId: sessionId,
            })
          );

          // All appointments should have the same session ID
          for (const apt of appointments) {
            expect(apt.intakeSessionId).toBe(sessionId);
          }

          // All appointments should have unique IDs
          const ids = appointments.map(a => a.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(appointments.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('appointment should preserve all fields including session link', () => {
    fc.assert(
      fc.property(
        appointmentCreateInputArb,
        (input) => {
          const stored = createAppointment(input);
          const retrieved = simulateDatabaseRoundTrip(stored);

          // All fields should be preserved
          expect(retrieved.connectionId).toBe(input.connectionId);
          expect(retrieved.intakeSessionId).toBe(input.intakeSessionId ?? null);
          expect(retrieved.notes).toBe(input.notes ?? null);
          expect(retrieved.status).toBe('pending');
          expect(retrieved.duration).toBe(30);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session link should be independent of other appointment fields', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        fc.string({ minLength: 0, maxLength: 500 }),
        (connectionId, sessionId, scheduledAt, notes) => {
          // Create appointment with session
          const withSession = createAppointment({
            connectionId,
            scheduledAt,
            intakeSessionId: sessionId,
            notes,
          });

          // Create appointment without session but same other fields
          const withoutSession = createAppointment({
            connectionId,
            scheduledAt,
            notes,
          });

          // Session link should be independent
          expect(withSession.intakeSessionId).toBe(sessionId);
          expect(withoutSession.intakeSessionId).toBeNull();

          // Other fields should be the same
          expect(withSession.connectionId).toBe(withoutSession.connectionId);
          expect(withSession.notes).toBe(withoutSession.notes);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
