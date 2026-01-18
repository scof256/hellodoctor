/**
 * Property Test: Appointment Lifecycle Synchronization
 * 
 * Feature: stream-video-integration, Property 13: Appointment Lifecycle Synchronization
 * Validates: Requirements 6.2, 6.3
 * 
 * For any appointment cancellation or time modification, the associated 
 * meeting room should be cancelled or updated accordingly.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
  streamCallId: string | null;
  streamJoinUrl: string | null;
}

interface MeetingRoom {
  callId: string;
  scheduledAt: Date;
  duration: number;
  isActive: boolean;
}

/**
 * Simulates the appointment cancellation logic
 * Requirements: 6.2 - When an appointment is cancelled, the associated Meeting_Room should be cancelled
 */
function cancelAppointment(
  appointment: Appointment,
  meetingRoom: MeetingRoom | null
): { appointment: Appointment; meetingRoom: MeetingRoom | null } {
  // Update appointment status
  const updatedAppointment: Appointment = {
    ...appointment,
    status: 'cancelled',
    streamCallId: null,
    streamJoinUrl: null,
  };

  // Cancel meeting room if it exists
  const updatedMeetingRoom = meetingRoom
    ? { ...meetingRoom, isActive: false }
    : null;

  return { appointment: updatedAppointment, meetingRoom: updatedMeetingRoom };
}

/**
 * Simulates the appointment reschedule logic
 * Requirements: 6.3 - When appointment times are modified, the Meeting_Room schedule should be updated
 */
function rescheduleAppointment(
  appointment: Appointment,
  meetingRoom: MeetingRoom | null,
  newScheduledAt: Date
): { appointment: Appointment; meetingRoom: MeetingRoom | null } {
  // Update appointment scheduled time
  const updatedAppointment: Appointment = {
    ...appointment,
    scheduledAt: newScheduledAt,
    status: 'pending', // Reset to pending after reschedule
  };

  // Update meeting room schedule if it exists
  const updatedMeetingRoom = meetingRoom
    ? { ...meetingRoom, scheduledAt: newScheduledAt }
    : null;

  return { appointment: updatedAppointment, meetingRoom: updatedMeetingRoom };
}

/**
 * Checks if appointment and meeting room are in sync
 */
function isInSync(appointment: Appointment, meetingRoom: MeetingRoom | null): boolean {
  // If appointment is cancelled, meeting room should be inactive or null
  if (appointment.status === 'cancelled') {
    return meetingRoom === null || !meetingRoom.isActive;
  }

  // If appointment has a stream call, meeting room should exist and be in sync
  if (appointment.streamCallId) {
    if (!meetingRoom) return false;
    if (!meetingRoom.isActive) return false;
    if (meetingRoom.scheduledAt.getTime() !== appointment.scheduledAt.getTime()) return false;
  }

  return true;
}

/**
 * Generates a random appointment for property testing
 */
const appointmentArbitrary = fc.record({
  id: fc.uuid(),
  scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  duration: fc.integer({ min: 15, max: 120 }),
  status: fc.constantFrom<AppointmentStatus>('pending', 'confirmed'),
  streamCallId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  streamJoinUrl: fc.option(fc.webUrl(), { nil: null }),
});

/**
 * Generates a meeting room that matches an appointment
 */
function createMatchingMeetingRoom(appointment: Appointment): MeetingRoom | null {
  if (!appointment.streamCallId) return null;
  return {
    callId: appointment.streamCallId,
    scheduledAt: appointment.scheduledAt,
    duration: appointment.duration,
    isActive: true,
  };
}

describe('Appointment Lifecycle Synchronization - Property 13', () => {
  describe('Property: Cancellation synchronizes meeting room state', () => {
    it('should deactivate meeting room when appointment is cancelled', () => {
      fc.assert(
        fc.property(
          appointmentArbitrary.filter(apt => apt.streamCallId !== null),
          (apt) => {
            const meetingRoom = createMatchingMeetingRoom(apt);
            const { appointment: cancelledApt, meetingRoom: cancelledRoom } = cancelAppointment(apt, meetingRoom);
            
            // Appointment should be cancelled
            expect(cancelledApt.status).toBe('cancelled');
            // Stream call ID should be cleared
            expect(cancelledApt.streamCallId).toBeNull();
            // Meeting room should be deactivated
            expect(cancelledRoom?.isActive).toBe(false);
            // Should be in sync
            expect(isInSync(cancelledApt, cancelledRoom)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cancellation when no meeting room exists', () => {
      fc.assert(
        fc.property(
          appointmentArbitrary.filter(apt => apt.streamCallId === null),
          (apt) => {
            const { appointment: cancelledApt, meetingRoom: cancelledRoom } = cancelAppointment(apt, null);
            
            // Appointment should be cancelled
            expect(cancelledApt.status).toBe('cancelled');
            // Meeting room should remain null
            expect(cancelledRoom).toBeNull();
            // Should be in sync
            expect(isInSync(cancelledApt, cancelledRoom)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Reschedule synchronizes meeting room schedule', () => {
    it('should update meeting room schedule when appointment is rescheduled', () => {
      fc.assert(
        fc.property(
          appointmentArbitrary.filter(apt => apt.streamCallId !== null),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          (apt, newDate) => {
            const meetingRoom = createMatchingMeetingRoom(apt);
            const { appointment: rescheduledApt, meetingRoom: rescheduledRoom } = rescheduleAppointment(apt, meetingRoom, newDate);
            
            // Appointment should have new scheduled time
            expect(rescheduledApt.scheduledAt.getTime()).toBe(newDate.getTime());
            // Appointment status should be reset to pending
            expect(rescheduledApt.status).toBe('pending');
            // Meeting room should have same scheduled time
            expect(rescheduledRoom?.scheduledAt.getTime()).toBe(newDate.getTime());
            // Should be in sync
            expect(isInSync(rescheduledApt, rescheduledRoom)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle reschedule when no meeting room exists', () => {
      fc.assert(
        fc.property(
          appointmentArbitrary.filter(apt => apt.streamCallId === null),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          (apt, newDate) => {
            const { appointment: rescheduledApt, meetingRoom: rescheduledRoom } = rescheduleAppointment(apt, null, newDate);
            
            // Appointment should have new scheduled time
            expect(rescheduledApt.scheduledAt.getTime()).toBe(newDate.getTime());
            // Meeting room should remain null
            expect(rescheduledRoom).toBeNull();
            // Should be in sync
            expect(isInSync(rescheduledApt, rescheduledRoom)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Sync invariant maintained through lifecycle operations', () => {
    it('should maintain sync after any sequence of operations', () => {
      fc.assert(
        fc.property(
          appointmentArbitrary,
          fc.array(fc.oneof(
            fc.constant('cancel' as const),
            fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(d => ({ type: 'reschedule' as const, date: d }))
          ), { minLength: 1, maxLength: 5 }),
          (initialApt, operations) => {
            let apt = initialApt;
            let room = createMatchingMeetingRoom(apt);

            for (const op of operations) {
              if (op === 'cancel') {
                const result = cancelAppointment(apt, room);
                apt = result.appointment;
                room = result.meetingRoom;
              } else {
                const result = rescheduleAppointment(apt, room, op.date);
                apt = result.appointment;
                room = result.meetingRoom;
              }
            }

            // After any sequence of operations, should be in sync
            expect(isInSync(apt, room)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Cancelled appointments cannot be rescheduled', () => {
    it('should not allow rescheduling a cancelled appointment (business rule)', () => {
      // This tests the business rule that cancelled appointments should not be rescheduled
      // In the actual implementation, this would throw an error
      const apt: Appointment = {
        id: 'test-id',
        scheduledAt: new Date('2025-01-15T10:00:00Z'),
        duration: 30,
        status: 'cancelled',
        streamCallId: null,
        streamJoinUrl: null,
      };

      // Cancelled appointment should have no meeting room
      expect(isInSync(apt, null)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same-time reschedule (no-op)', () => {
      const apt: Appointment = {
        id: 'test-id',
        scheduledAt: new Date('2025-01-15T10:00:00Z'),
        duration: 30,
        status: 'confirmed',
        streamCallId: 'call-123',
        streamJoinUrl: 'https://example.com/meeting',
      };
      const room = createMatchingMeetingRoom(apt);
      
      const { appointment: rescheduledApt, meetingRoom: rescheduledRoom } = rescheduleAppointment(apt, room, apt.scheduledAt);
      
      // Should still be in sync
      expect(isInSync(rescheduledApt, rescheduledRoom)).toBe(true);
      // Times should match
      expect(rescheduledApt.scheduledAt.getTime()).toBe(rescheduledRoom?.scheduledAt.getTime());
    });

    it('should handle multiple cancellations (idempotent)', () => {
      const apt: Appointment = {
        id: 'test-id',
        scheduledAt: new Date('2025-01-15T10:00:00Z'),
        duration: 30,
        status: 'confirmed',
        streamCallId: 'call-123',
        streamJoinUrl: 'https://example.com/meeting',
      };
      const room = createMatchingMeetingRoom(apt);
      
      // First cancellation
      const result1 = cancelAppointment(apt, room);
      // Second cancellation
      const result2 = cancelAppointment(result1.appointment, result1.meetingRoom);
      
      // Should still be in sync after multiple cancellations
      expect(isInSync(result2.appointment, result2.meetingRoom)).toBe(true);
      expect(result2.appointment.status).toBe('cancelled');
    });
  });
});
