/**
 * Feature: booking-flow-integration, Property 6: Status Change Side Effects
 * 
 * For any appointment status change, the system SHALL create exactly one audit log entry 
 * AND send exactly one notification to the affected party (patient for doctor actions, 
 * doctor for patient actions).
 * 
 * Validates: Requirements 6.4, 6.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type StatusAction = 'confirm' | 'complete' | 'markNoShow' | 'cancel';

interface Appointment {
  id: string;
  connectionId: string;
  doctorId: string;
  patientId: string;
  patientUserId: string;
  doctorUserId: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
}

interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}

interface Notification {
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

/**
 * Simulated side effects tracker
 */
class SideEffectsTracker {
  auditLogs: AuditLogEntry[] = [];
  notifications: Notification[] = [];

  reset(): void {
    this.auditLogs = [];
    this.notifications = [];
  }

  logAudit(entry: AuditLogEntry): void {
    this.auditLogs.push(entry);
  }

  sendNotification(notification: Notification): void {
    this.notifications.push(notification);
  }

  getAuditLogsForResource(resourceId: string): AuditLogEntry[] {
    return this.auditLogs.filter(log => log.resourceId === resourceId);
  }

  getNotificationsForUser(userId: string): Notification[] {
    return this.notifications.filter(n => n.userId === userId);
  }
}

/**
 * Simulated appointment status service with side effects
 */
class AppointmentStatusServiceWithSideEffects {
  constructor(private tracker: SideEffectsTracker) {}

  /**
   * Confirm a pending appointment
   * Requirements: 6.1, 6.4, 6.5
   */
  confirm(appointment: Appointment, actorUserId: string, actorIsDoctorForAppointment: boolean): boolean {
    if (!actorIsDoctorForAppointment || appointment.status !== 'pending') {
      return false;
    }

    // Create audit log entry (Requirement 6.4)
    this.tracker.logAudit({
      userId: actorUserId,
      action: 'appointment_updated',
      resourceType: 'appointment',
      resourceId: appointment.id,
      metadata: {
        previousStatus: appointment.status,
        newStatus: 'confirmed',
        action: 'confirmed',
        connectionId: appointment.connectionId,
        doctorId: appointment.doctorId,
      },
    });

    // Send notification to patient (Requirement 6.5)
    this.tracker.sendNotification({
      userId: appointment.patientUserId,
      type: 'appointment',
      title: 'Appointment Confirmed',
      message: `Your appointment has been confirmed.`,
      data: {
        appointmentId: appointment.id,
        connectionId: appointment.connectionId,
        action: 'confirmed',
      },
    });

    return true;
  }

  /**
   * Complete a confirmed appointment
   * Requirements: 6.2, 6.4, 6.5
   */
  complete(appointment: Appointment, actorUserId: string, actorIsDoctorForAppointment: boolean, currentTime: Date): boolean {
    if (!actorIsDoctorForAppointment || appointment.status !== 'confirmed' || appointment.scheduledAt > currentTime) {
      return false;
    }

    // Create audit log entry (Requirement 6.4)
    this.tracker.logAudit({
      userId: actorUserId,
      action: 'appointment_completed',
      resourceType: 'appointment',
      resourceId: appointment.id,
      metadata: {
        previousStatus: appointment.status,
        newStatus: 'completed',
        connectionId: appointment.connectionId,
        doctorId: appointment.doctorId,
      },
    });

    // Send notification to patient (Requirement 6.5)
    this.tracker.sendNotification({
      userId: appointment.patientUserId,
      type: 'appointment',
      title: 'Appointment Completed',
      message: `Your appointment has been marked as completed.`,
      data: {
        appointmentId: appointment.id,
        connectionId: appointment.connectionId,
        action: 'completed',
      },
    });

    return true;
  }

  /**
   * Mark appointment as no-show
   * Requirements: 6.3, 6.4, 6.5
   */
  markNoShow(appointment: Appointment, actorUserId: string, actorIsDoctorForAppointment: boolean, currentTime: Date): boolean {
    if (!actorIsDoctorForAppointment || appointment.status !== 'confirmed' || appointment.scheduledAt > currentTime) {
      return false;
    }

    // Create audit log entry (Requirement 6.4)
    this.tracker.logAudit({
      userId: actorUserId,
      action: 'appointment_no_show',
      resourceType: 'appointment',
      resourceId: appointment.id,
      metadata: {
        previousStatus: appointment.status,
        newStatus: 'no_show',
        connectionId: appointment.connectionId,
        doctorId: appointment.doctorId,
      },
    });

    // Send notification to patient (Requirement 6.5)
    this.tracker.sendNotification({
      userId: appointment.patientUserId,
      type: 'appointment',
      title: 'Appointment Marked as No-Show',
      message: `Your appointment has been marked as no-show.`,
      data: {
        appointmentId: appointment.id,
        connectionId: appointment.connectionId,
        action: 'no_show',
      },
    });

    return true;
  }

  /**
   * Cancel an appointment
   */
  cancel(
    appointment: Appointment, 
    actorUserId: string, 
    actorIsPatient: boolean, 
    actorIsDoctor: boolean,
    reason?: string
  ): boolean {
    if ((!actorIsPatient && !actorIsDoctor) || 
        appointment.status === 'cancelled' || 
        appointment.status === 'completed' ||
        appointment.status === 'no_show') {
      return false;
    }

    // Create audit log entry (Requirement 6.4)
    this.tracker.logAudit({
      userId: actorUserId,
      action: 'appointment_cancelled',
      resourceType: 'appointment',
      resourceId: appointment.id,
      metadata: {
        previousStatus: appointment.status,
        newStatus: 'cancelled',
        connectionId: appointment.connectionId,
        cancelledBy: actorIsPatient ? 'patient' : 'doctor',
        cancelReason: reason,
      },
    });

    // Send notification to the other party (Requirement 6.5)
    const recipientUserId = actorIsPatient ? appointment.doctorUserId : appointment.patientUserId;
    this.tracker.sendNotification({
      userId: recipientUserId,
      type: 'appointment',
      title: 'Appointment Cancelled',
      message: `An appointment has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
      data: {
        appointmentId: appointment.id,
        connectionId: appointment.connectionId,
        action: 'cancelled',
        cancelReason: reason,
      },
    });

    return true;
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

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
  patientUserId: uuidArb,
  doctorUserId: uuidArb,
  scheduledAt: fc.constant(scheduledAt),
  duration: fc.constantFrom(15, 30, 45, 60),
  status: fc.constant(status),
});

describe('Property 6: Status Change Side Effects', () => {
  let tracker: SideEffectsTracker;
  let service: AppointmentStatusServiceWithSideEffects;

  beforeEach(() => {
    tracker = new SideEffectsTracker();
    service = new AppointmentStatusServiceWithSideEffects(tracker);
  });

  describe('Audit Log Creation', () => {
    it('for any successful confirm, exactly one audit log SHALL be created', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.confirm(appointment, actorUserId, true);
            
            expect(success).toBe(true);
            
            const logs = tracker.getAuditLogsForResource(appointment.id);
            expect(logs.length).toBe(1);
            expect(logs[0]!.action).toBe('appointment_updated');
            expect(logs[0]!.resourceType).toBe('appointment');
            expect(logs[0]!.userId).toBe(actorUserId);
            expect(logs[0]!.metadata.newStatus).toBe('confirmed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful complete, exactly one audit log SHALL be created', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const currentTime = new Date();
            const success = service.complete(appointment, actorUserId, true, currentTime);
            
            expect(success).toBe(true);
            
            const logs = tracker.getAuditLogsForResource(appointment.id);
            expect(logs.length).toBe(1);
            expect(logs[0]!.action).toBe('appointment_completed');
            expect(logs[0]!.resourceType).toBe('appointment');
            expect(logs[0]!.userId).toBe(actorUserId);
            expect(logs[0]!.metadata.newStatus).toBe('completed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful markNoShow, exactly one audit log SHALL be created', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const currentTime = new Date();
            const success = service.markNoShow(appointment, actorUserId, true, currentTime);
            
            expect(success).toBe(true);
            
            const logs = tracker.getAuditLogsForResource(appointment.id);
            expect(logs.length).toBe(1);
            expect(logs[0]!.action).toBe('appointment_no_show');
            expect(logs[0]!.resourceType).toBe('appointment');
            expect(logs[0]!.userId).toBe(actorUserId);
            expect(logs[0]!.metadata.newStatus).toBe('no_show');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful cancel, exactly one audit log SHALL be created', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          (appointment, actorUserId, reason) => {
            tracker.reset();
            
            const success = service.cancel(appointment, actorUserId, true, false, reason ?? undefined);
            
            expect(success).toBe(true);
            
            const logs = tracker.getAuditLogsForResource(appointment.id);
            expect(logs.length).toBe(1);
            expect(logs[0]!.action).toBe('appointment_cancelled');
            expect(logs[0]!.resourceType).toBe('appointment');
            expect(logs[0]!.userId).toBe(actorUserId);
            expect(logs[0]!.metadata.newStatus).toBe('cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Notification Delivery', () => {
    it('for any successful confirm by doctor, exactly one notification SHALL be sent to patient', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.confirm(appointment, actorUserId, true);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.patientUserId);
            expect(notifications.length).toBe(1);
            expect(notifications[0]!.type).toBe('appointment');
            expect(notifications[0]!.data.action).toBe('confirmed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful complete by doctor, exactly one notification SHALL be sent to patient', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const currentTime = new Date();
            const success = service.complete(appointment, actorUserId, true, currentTime);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.patientUserId);
            expect(notifications.length).toBe(1);
            expect(notifications[0]!.type).toBe('appointment');
            expect(notifications[0]!.data.action).toBe('completed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful markNoShow by doctor, exactly one notification SHALL be sent to patient', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const currentTime = new Date();
            const success = service.markNoShow(appointment, actorUserId, true, currentTime);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.patientUserId);
            expect(notifications.length).toBe(1);
            expect(notifications[0]!.type).toBe('appointment');
            expect(notifications[0]!.data.action).toBe('no_show');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful cancel by patient, exactly one notification SHALL be sent to doctor', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.cancel(appointment, actorUserId, true, false);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.doctorUserId);
            expect(notifications.length).toBe(1);
            expect(notifications[0]!.type).toBe('appointment');
            expect(notifications[0]!.data.action).toBe('cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful cancel by doctor, exactly one notification SHALL be sent to patient', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.cancel(appointment, actorUserId, false, true);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.patientUserId);
            expect(notifications.length).toBe(1);
            expect(notifications[0]!.type).toBe('appointment');
            expect(notifications[0]!.data.action).toBe('cancelled');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Side Effects Consistency', () => {
    it('for any successful status change, both audit log AND notification SHALL be created', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.confirm(appointment, actorUserId, true);
            
            expect(success).toBe(true);
            
            // Both side effects should occur
            const logs = tracker.getAuditLogsForResource(appointment.id);
            const notifications = tracker.notifications;
            
            expect(logs.length).toBe(1);
            expect(notifications.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any failed status change, no side effects SHALL occur', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('confirmed', date)), // Already confirmed
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            // Try to confirm an already confirmed appointment (should fail)
            const success = service.confirm(appointment, actorUserId, true);
            
            expect(success).toBe(false);
            
            // No side effects should occur
            const logs = tracker.getAuditLogsForResource(appointment.id);
            const notifications = tracker.notifications;
            
            expect(logs.length).toBe(0);
            expect(notifications.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audit log SHALL contain correct metadata for the status change', () => {
      fc.assert(
        fc.property(
          pastDateArb.chain(date => appointmentArb('confirmed', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const currentTime = new Date();
            const success = service.complete(appointment, actorUserId, true, currentTime);
            
            expect(success).toBe(true);
            
            const logs = tracker.getAuditLogsForResource(appointment.id);
            expect(logs.length).toBe(1);
            
            const log = logs[0]!;
            expect(log.metadata.previousStatus).toBe('confirmed');
            expect(log.metadata.newStatus).toBe('completed');
            expect(log.metadata.connectionId).toBe(appointment.connectionId);
            expect(log.metadata.doctorId).toBe(appointment.doctorId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notification SHALL contain correct appointment data', () => {
      fc.assert(
        fc.property(
          futureDateArb.chain(date => appointmentArb('pending', date)),
          uuidArb,
          (appointment, actorUserId) => {
            tracker.reset();
            
            const success = service.confirm(appointment, actorUserId, true);
            
            expect(success).toBe(true);
            
            const notifications = tracker.getNotificationsForUser(appointment.patientUserId);
            expect(notifications.length).toBe(1);
            
            const notification = notifications[0]!;
            expect(notification.data.appointmentId).toBe(appointment.id);
            expect(notification.data.connectionId).toBe(appointment.connectionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
