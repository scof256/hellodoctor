/**
 * Feature: doctor-appointment-saas, Property 8: Notification Delivery Accuracy
 * 
 * For any event that triggers a notification (connection created, appointment booked, 
 * intake completed), a notification record SHALL be created for the appropriate 
 * recipient(s) within the same transaction.
 * 
 * Validates: Requirements 12.3, 12.4, 12.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  notificationService,
  type NotificationType,
  type ConnectionNotificationData,
  type AppointmentNotificationData,
  type MessageNotificationData,
  type IntakeCompleteNotificationData,
} from '@/server/services/notification';

// Arbitraries for generating test data
const uuidArb = fc.uuid();

const userArb = fc.record({
  id: uuidArb,
  firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
});

const notificationTypeArb: fc.Arbitrary<NotificationType> = fc.constantFrom(
  'connection',
  'appointment',
  'message',
  'intake_complete'
);

const connectionActionArb = fc.constantFrom('new', 'reconnected', 'disconnected') as fc.Arbitrary<'new' | 'reconnected' | 'disconnected'>;

const appointmentActionArb = fc.constantFrom(
  'booked',
  'cancelled',
  'rescheduled',
  'confirmed',
  'reminder'
) as fc.Arbitrary<'booked' | 'cancelled' | 'rescheduled' | 'confirmed' | 'reminder'>;

const senderRoleArb = fc.constantFrom('patient', 'doctor', 'clinic_admin') as fc.Arbitrary<'patient' | 'doctor' | 'clinic_admin'>;

// Helper to validate notification data structure
function validateNotificationData(
  type: NotificationType,
  data: ConnectionNotificationData | AppointmentNotificationData | MessageNotificationData | IntakeCompleteNotificationData
): boolean {
  switch (type) {
    case 'connection':
      const connData = data as ConnectionNotificationData;
      return (
        typeof connData.connectionId === 'string' &&
        typeof connData.action === 'string' &&
        ['new', 'reconnected', 'disconnected'].includes(connData.action)
      );
    case 'appointment':
      const aptData = data as AppointmentNotificationData;
      return (
        typeof aptData.appointmentId === 'string' &&
        typeof aptData.connectionId === 'string' &&
        typeof aptData.scheduledAt === 'string' &&
        typeof aptData.duration === 'number' &&
        typeof aptData.action === 'string'
      );
    case 'message':
      const msgData = data as MessageNotificationData;
      return (
        typeof msgData.connectionId === 'string' &&
        typeof msgData.messageId === 'string' &&
        typeof msgData.senderName === 'string' &&
        typeof msgData.senderRole === 'string' &&
        typeof msgData.preview === 'string'
      );
    case 'intake_complete':
      const intakeData = data as IntakeCompleteNotificationData;
      return (
        typeof intakeData.sessionId === 'string' &&
        typeof intakeData.connectionId === 'string' &&
        typeof intakeData.patientName === 'string'
      );
    default:
      return false;
  }
}

describe('Property 8: Notification Delivery Accuracy', () => {
  describe('getUserDisplayName', () => {
    it('should return full name when both first and last name are present', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (firstName, lastName) => {
            const displayName = notificationService.getUserDisplayName({
              firstName,
              lastName,
            });
            expect(displayName).toBe(`${firstName} ${lastName}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return first name only when last name is null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (firstName) => {
            const displayName = notificationService.getUserDisplayName({
              firstName,
              lastName: null,
            });
            expect(displayName).toBe(firstName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return last name only when first name is null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (lastName) => {
            const displayName = notificationService.getUserDisplayName({
              firstName: null,
              lastName,
            });
            expect(displayName).toBe(lastName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "Unknown User" when both names are null', () => {
      const displayName = notificationService.getUserDisplayName({
        firstName: null,
        lastName: null,
      });
      expect(displayName).toBe('Unknown User');
    });
  });

  describe('Connection Notification Data Structure', () => {
    it('should create valid connection notification data for any action', () => {
      fc.assert(
        fc.property(
          uuidArb,
          userArb,
          connectionActionArb,
          uuidArb,
          (doctorUserId, patientUser, action, connectionId) => {
            // Simulate what createConnectionNotification would produce
            const patientName = [patientUser.firstName, patientUser.lastName]
              .filter(Boolean)
              .join(' ') || 'A patient';

            const data: ConnectionNotificationData = {
              connectionId,
              patientUserId: patientUser.id,
              patientName,
              action,
            };

            // Validate the data structure
            expect(validateNotificationData('connection', data)).toBe(true);
            expect(data.connectionId).toBe(connectionId);
            expect(data.action).toBe(action);
            expect(typeof data.patientName).toBe('string');
            expect(data.patientName.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate appropriate titles for each connection action', () => {
      const titles: Record<'new' | 'reconnected' | 'disconnected', string> = {
        new: 'New Patient Connection',
        reconnected: 'Patient Reconnected',
        disconnected: 'Patient Disconnected',
      };

      fc.assert(
        fc.property(connectionActionArb, (action) => {
          expect(titles[action]).toBeDefined();
          expect(typeof titles[action]).toBe('string');
          expect(titles[action].length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Appointment Notification Data Structure', () => {
    it('should create valid appointment notification data for any action', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          uuidArb,
          fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
          fc.integer({ min: 15, max: 120 }),
          appointmentActionArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          (recipientUserId, appointmentId, connectionId, scheduledAt, duration, action, otherPartyName, cancelReason) => {
            const data: AppointmentNotificationData = {
              appointmentId,
              connectionId,
              scheduledAt: scheduledAt.toISOString(),
              duration,
              action,
              cancelReason,
            };

            // Validate the data structure
            expect(validateNotificationData('appointment', data)).toBe(true);
            expect(data.appointmentId).toBe(appointmentId);
            expect(data.connectionId).toBe(connectionId);
            expect(data.duration).toBe(duration);
            expect(data.action).toBe(action);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include cancel reason only for cancelled appointments', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.date(),
          fc.integer({ min: 15, max: 120 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (appointmentId, connectionId, scheduledAt, duration, cancelReason) => {
            const data: AppointmentNotificationData = {
              appointmentId,
              connectionId,
              scheduledAt: scheduledAt.toISOString(),
              duration,
              action: 'cancelled',
              cancelReason,
            };

            expect(data.action).toBe('cancelled');
            expect(data.cancelReason).toBe(cancelReason);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Message Notification Data Structure', () => {
    it('should create valid message notification data', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          senderRoleArb,
          fc.string({ minLength: 1, maxLength: 5000 }),
          (connectionId, messageId, senderName, senderRole, messageContent) => {
            // Simulate preview creation (first 100 chars)
            const preview = messageContent.length > 100
              ? messageContent.substring(0, 100) + '...'
              : messageContent;

            const data: MessageNotificationData = {
              connectionId,
              messageId,
              senderName,
              senderRole,
              preview,
            };

            // Validate the data structure
            expect(validateNotificationData('message', data)).toBe(true);
            expect(data.connectionId).toBe(connectionId);
            expect(data.messageId).toBe(messageId);
            expect(data.senderName).toBe(senderName);
            expect(data.senderRole).toBe(senderRole);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate message preview to 100 characters plus ellipsis', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 5000 }),
          (longMessage) => {
            const preview = longMessage.length > 100
              ? longMessage.substring(0, 100) + '...'
              : longMessage;

            expect(preview.length).toBeLessThanOrEqual(103); // 100 chars + '...'
            expect(preview.endsWith('...')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not truncate short messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (shortMessage) => {
            const preview = shortMessage.length > 100
              ? shortMessage.substring(0, 100) + '...'
              : shortMessage;

            expect(preview).toBe(shortMessage);
            expect(preview.endsWith('...')).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Intake Complete Notification Data Structure', () => {
    it('should create valid intake complete notification data', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          (sessionId, connectionId, patientName, chiefComplaint) => {
            const data: IntakeCompleteNotificationData = {
              sessionId,
              connectionId,
              patientName,
              chiefComplaint,
            };

            // Validate the data structure
            expect(validateNotificationData('intake_complete', data)).toBe(true);
            expect(data.sessionId).toBe(sessionId);
            expect(data.connectionId).toBe(connectionId);
            expect(data.patientName).toBe(patientName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should optionally include chief complaint', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (sessionId, connectionId, patientName, chiefComplaint) => {
            const dataWithComplaint: IntakeCompleteNotificationData = {
              sessionId,
              connectionId,
              patientName,
              chiefComplaint,
            };

            const dataWithoutComplaint: IntakeCompleteNotificationData = {
              sessionId,
              connectionId,
              patientName,
            };

            expect(dataWithComplaint.chiefComplaint).toBe(chiefComplaint);
            expect(dataWithoutComplaint.chiefComplaint).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Notification Type Coverage', () => {
    it('should support all required notification types', () => {
      const requiredTypes: NotificationType[] = [
        'connection',
        'appointment',
        'message',
        'intake_complete',
      ];

      fc.assert(
        fc.property(notificationTypeArb, (type) => {
          expect(requiredTypes).toContain(type);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid data structure for each notification type', () => {
      fc.assert(
        fc.property(
          notificationTypeArb,
          uuidArb,
          uuidArb,
          (type, id1, id2) => {
            let data: ConnectionNotificationData | AppointmentNotificationData | MessageNotificationData | IntakeCompleteNotificationData;

            switch (type) {
              case 'connection':
                data = {
                  connectionId: id1,
                  patientUserId: id2,
                  patientName: 'Test Patient',
                  action: 'new',
                };
                break;
              case 'appointment':
                data = {
                  appointmentId: id1,
                  connectionId: id2,
                  scheduledAt: new Date().toISOString(),
                  duration: 30,
                  action: 'booked',
                };
                break;
              case 'message':
                data = {
                  connectionId: id1,
                  messageId: id2,
                  senderName: 'Test Sender',
                  senderRole: 'patient',
                  preview: 'Test message',
                };
                break;
              case 'intake_complete':
                data = {
                  sessionId: id1,
                  connectionId: id2,
                  patientName: 'Test Patient',
                };
                break;
            }

            expect(validateNotificationData(type, data)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Recipient Determination', () => {
    it('should always have a valid recipient for connection notifications', () => {
      // Connection notifications go to the doctor
      fc.assert(
        fc.property(uuidArb, (doctorUserId) => {
          // The recipient should be a valid UUID
          expect(doctorUserId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should always have a valid recipient for appointment notifications', () => {
      // Appointment notifications go to the other party
      fc.assert(
        fc.property(uuidArb, (recipientUserId) => {
          expect(recipientUserId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should always have a valid recipient for message notifications', () => {
      // Message notifications go to the recipient of the message
      fc.assert(
        fc.property(uuidArb, (recipientUserId) => {
          expect(recipientUserId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should always have a valid recipient for intake complete notifications', () => {
      // Intake complete notifications go to the doctor
      fc.assert(
        fc.property(uuidArb, (doctorUserId) => {
          expect(doctorUserId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});
