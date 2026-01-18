/**
 * Feature: booking-flow-integration, Property 5: Appointment Status Transitions
 * 
 * For any appointment, the following status transitions SHALL be valid:
 * - `pending` → `confirmed` (via confirm mutation)
 * - `confirmed` → `completed` (via complete mutation, only for past appointments)
 * - `confirmed` → `no_show` (via markNoShow mutation, only for past appointments)
 * - `pending` or `confirmed` → `cancelled` (via cancel mutation)
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  connectionId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
}

interface StatusTransitionResult {
  success: boolean;
  newStatus?: AppointmentStatus;
  error?: string;
}

/**
 * Simulated appointment status transition service
 * Implements the business rules for status transitions
 */
class AppointmentStatusService {
  /**
   * Confirm a pending appointment
   * Requirements: 6.1
   */
  confirm(appointment: Appointment, actorIsDoctorForAppointment: boolean): StatusTransitionResult {
    // Verify actor is the doctor
    if (!actorIsDoctorForAppointment) {
      return { success: false, error: 'Only the doctor can confirm appointments' };
    }

    // Verify appointment is in pending status
    if (appointment.status !== 'pending') {
      return { 
        success: false, 
        error: `Cannot confirm appointment with status '${appointment.status}'. Only pending appointments can be confirmed.` 
      };
    }

    return { success: true, newStatus: 'confirmed' };
  }

  /**
   * Complete a confirmed appointment
   * Requirements: 6.2
   */
  complete(appointment: Appointment, actorIsDoctorForAppointment: boolean, currentTime: Date): StatusTransitionResult {
    // Verify actor is the doctor
    if (!actorIsDoctorForAppointment) {
      return { success: false, error: 'Only the doctor can mark appointments as completed' };
    }

    // Verify appointment is in confirmed status
    if (appointment.status !== 'confirmed') {
      return { 
        success: false, 
        error: `Cannot complete appointment with status '${appointment.status}'. Only confirmed appointments can be completed.` 
      };
    }

    // Verify appointment is in the past
    if (appointment.scheduledAt > currentTime) {
      return { success: false, error: 'Cannot mark a future appointment as completed' };
    }

    return { success: true, newStatus: 'completed' };
  }

  /**
   * Mark appointment as no-show
   * Requirements: 6.3
   */
  markNoShow(appointment: Appointment, actorIsDoctorForAppointment: boolean, currentTime: Date): StatusTransitionResult {
    // Verify actor is the doctor
    if (!actorIsDoctorForAppointment) {
      return { success: false, error: 'Only the doctor can mark appointments as no-show' };
    }

    // Verify appointment is in confirmed status
    if (appointment.status !== 'confirmed') {
      return { 
        success: false, 
        error: `Cannot mark appointment with status '${appointment.status}' as no-show. Only confirmed appointments can be marked as no-show.` 
      };
    }

    // Verify appointment is in the past
    if (appointment.scheduledAt > currentTime) {
      return { success: false, error: 'Cannot mark a future appointment as no-show' };
    }

    return { success: true, newStatus: 'no_show' };
  }

  /**
   * Cancel an appointment
   */
  cancel(appointment: Appointment, actorHasPermission: boolean): StatusTransitionResult {
    // Verify actor has permission
    if (!actorHasPermission) {
      return { success: false, error: 'You do not have permission to cancel this appointment' };
    }

    // Cannot cancel already cancelled appointments
    if (appointment.status === 'cancelled') {
      return { success: false, error: 'Appointment is already cancelled' };
    }

    // Cannot cancel completed appointments
    if (appointment.status === 'completed') {
      return { success: false, error: 'Cannot cancel a completed appointment' };
    }

    // Cannot cancel no-show appointments
    if (appointment.status === 'no_show') {
      return { success: false, error: 'Cannot cancel a no-show appointment' };
    }

    return { success: true, newStatus: 'cancelled' };
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const appointmentStatusArb = fc.constantFrom<AppointmentStatus>(
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

// Generate a past date
const pastDateArb = fc.integer({ min: 1, max: 30 }).map((daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(10, 0, 0, 0);
  return date;
});

// Generate a future date
const futureDateArb = fc.integer({ min: 1, max: 30 }).map((daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(10, 0, 0, 0);
  return date;
});

const appointmentArb = (status: AppointmentStatus, scheduledAt: Date) => fc.record({
  id: uuidArb,
  connectionId: uuidArb,
  doctorId: uuidArb,
  patientId: uuidArb,
  scheduledAt: fc.constant(scheduledAt),
  duration: fc.constantFrom(15, 30, 45, 60),
  status: fc.constant(status),
});

describe('Property 5: Appointment Status Transitions', () => {
  const service = new AppointmentStatusService();

  describe('Confirm Transition (pending → confirmed)', () => {
    it('for any pending appointment, confirm by doctor SHALL succeed', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          (appointment) => {
            const result = service.confirm(appointment, true);
            
            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('confirmed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any non-pending appointment, confirm SHALL fail', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AppointmentStatus>('confirmed', 'completed', 'cancelled', 'no_show'),
          futureDateArb,
          (status, date) => {
            const appointment: Appointment = {
              id: 'test-id',
              connectionId: 'conn-id',
              doctorId: 'doc-id',
              patientId: 'pat-id',
              scheduledAt: date,
              duration: 30,
              status,
            };

            const result = service.confirm(appointment, true);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only pending appointments can be confirmed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any appointment, confirm by non-doctor SHALL fail', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          (appointment) => {
            const result = service.confirm(appointment, false);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only the doctor can confirm');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Transition (confirmed → completed)', () => {
    it('for any past confirmed appointment, complete by doctor SHALL succeed', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.complete(appointment, true, currentTime);
            
            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('completed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any future confirmed appointment, complete SHALL fail', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.complete(appointment, true, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot mark a future appointment as completed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any non-confirmed appointment, complete SHALL fail', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AppointmentStatus>('pending', 'completed', 'cancelled', 'no_show'),
          pastDateArb,
          (status, date) => {
            const appointment: Appointment = {
              id: 'test-id',
              connectionId: 'conn-id',
              doctorId: 'doc-id',
              patientId: 'pat-id',
              scheduledAt: date,
              duration: 30,
              status,
            };

            const currentTime = new Date();
            const result = service.complete(appointment, true, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only confirmed appointments can be completed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any appointment, complete by non-doctor SHALL fail', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.complete(appointment, false, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only the doctor can mark appointments as completed');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No-Show Transition (confirmed → no_show)', () => {
    it('for any past confirmed appointment, markNoShow by doctor SHALL succeed', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.markNoShow(appointment, true, currentTime);
            
            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('no_show');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any future confirmed appointment, markNoShow SHALL fail', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.markNoShow(appointment, true, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot mark a future appointment as no-show');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any non-confirmed appointment, markNoShow SHALL fail', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AppointmentStatus>('pending', 'completed', 'cancelled', 'no_show'),
          pastDateArb,
          (status, date) => {
            const appointment: Appointment = {
              id: 'test-id',
              connectionId: 'conn-id',
              doctorId: 'doc-id',
              patientId: 'pat-id',
              scheduledAt: date,
              duration: 30,
              status,
            };

            const currentTime = new Date();
            const result = service.markNoShow(appointment, true, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only confirmed appointments can be marked as no-show');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any appointment, markNoShow by non-doctor SHALL fail', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const currentTime = new Date();
            const result = service.markNoShow(appointment, false, currentTime);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Only the doctor can mark appointments as no-show');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cancel Transition', () => {
    it('for any pending appointment, cancel with permission SHALL succeed', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          (appointment) => {
            const result = service.cancel(appointment, true);
            
            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any confirmed appointment, cancel with permission SHALL succeed', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('confirmed', date)),
          (appointment) => {
            const result = service.cancel(appointment, true);
            
            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any completed appointment, cancel SHALL fail', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('completed', date)),
          (appointment) => {
            const result = service.cancel(appointment, true);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot cancel a completed appointment');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any already cancelled appointment, cancel SHALL fail', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('cancelled', date)),
          (appointment) => {
            const result = service.cancel(appointment, true);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Appointment is already cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any appointment, cancel without permission SHALL fail', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          (appointment) => {
            const result = service.cancel(appointment, false);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('do not have permission');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invalid Transitions', () => {
    it('for any terminal status (completed, cancelled, no_show), no further transitions SHALL be allowed', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AppointmentStatus>('completed', 'cancelled', 'no_show'),
          pastDateArb,
          (status, date) => {
            const appointment: Appointment = {
              id: 'test-id',
              connectionId: 'conn-id',
              doctorId: 'doc-id',
              patientId: 'pat-id',
              scheduledAt: date,
              duration: 30,
              status,
            };

            const currentTime = new Date();

            // Try all transitions
            const confirmResult = service.confirm(appointment, true);
            const completeResult = service.complete(appointment, true, currentTime);
            const noShowResult = service.markNoShow(appointment, true, currentTime);

            // All should fail
            expect(confirmResult.success).toBe(false);
            expect(completeResult.success).toBe(false);
            expect(noShowResult.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
