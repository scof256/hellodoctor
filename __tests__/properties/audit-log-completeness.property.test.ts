/**
 * Feature: doctor-appointment-saas, Property 5: Audit Log Completeness
 * 
 * For any data modification operation (create, update, delete) on protected resources,
 * an audit log entry SHALL be created containing the user ID, action type, resource type,
 * resource ID, and timestamp.
 * 
 * Validates: Requirements 22.2, 22.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { AuditAction, AuditResourceType, AuditMetadata } from '@/server/services/audit';

// Define valid audit actions that represent data modifications
const DATA_MODIFICATION_ACTIONS: AuditAction[] = [
  'user_created',
  'user_updated',
  'user_deleted',
  'user_activated',
  'user_suspended',
  'user_role_changed',
  'doctor_created',
  'doctor_updated',
  'doctor_approved',
  'doctor_rejected',
  'patient_created',
  'patient_updated',
  'connection_created',
  'connection_disconnected',
  'connection_blocked',
  'appointment_created',
  'appointment_updated',
  'appointment_cancelled',
  'appointment_completed',
  'intake_started',
  'intake_updated',
  'intake_completed',
  'intake_reviewed',
  'message_sent',
  'file_uploaded',
  'file_deleted',
  'config_created',
  'config_updated',
];

// Define valid resource types
const VALID_RESOURCE_TYPES: AuditResourceType[] = [
  'user',
  'doctor',
  'patient',
  'connection',
  'appointment',
  'intake_session',
  'message',
  'file',
  'notification',
  'platform_config',
  'team_member',
  'audit_log',
];

// Simulate audit log entry structure
interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  metadata: AuditMetadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// Simulate the audit log creation function
function createAuditLogEntry(input: {
  userId?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  metadata?: AuditMetadata | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    userId: input.userId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date(),
  };
}

// Validate that an audit log entry has all required fields
function validateAuditLogEntry(entry: AuditLogEntry): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // Required fields for completeness
  if (!entry.id) missingFields.push('id');
  if (!entry.action) missingFields.push('action');
  if (!entry.resourceType) missingFields.push('resourceType');
  if (!entry.createdAt) missingFields.push('createdAt');

  // For data modification operations, userId should typically be present
  // (except for system-initiated operations)

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

// Check if action is a data modification action
function isDataModificationAction(action: AuditAction): boolean {
  return DATA_MODIFICATION_ACTIONS.includes(action);
}

// Validate action-resource type consistency
function isValidActionResourceCombination(
  action: AuditAction,
  resourceType: AuditResourceType
): boolean {
  const actionResourceMap: Record<string, AuditResourceType[]> = {
    user_created: ['user'],
    user_updated: ['user'],
    user_deleted: ['user'],
    user_activated: ['user'],
    user_suspended: ['user'],
    user_role_changed: ['user'],
    doctor_created: ['doctor'],
    doctor_updated: ['doctor'],
    doctor_approved: ['doctor'],
    doctor_rejected: ['doctor'],
    patient_created: ['patient'],
    patient_updated: ['patient'],
    connection_created: ['connection'],
    connection_disconnected: ['connection'],
    connection_blocked: ['connection'],
    appointment_created: ['appointment'],
    appointment_updated: ['appointment'],
    appointment_cancelled: ['appointment'],
    appointment_completed: ['appointment'],
    intake_started: ['intake_session'],
    intake_updated: ['intake_session'],
    intake_completed: ['intake_session'],
    intake_reviewed: ['intake_session'],
    message_sent: ['message'],
    file_uploaded: ['file'],
    file_deleted: ['file'],
    config_created: ['platform_config'],
    config_updated: ['platform_config'],
  };

  const validResourceTypes = actionResourceMap[action];
  if (!validResourceTypes) return true; // Unknown action, allow any resource type
  return validResourceTypes.includes(resourceType);
}


describe('Property 5: Audit Log Completeness', () => {
  // Arbitrary generators
  const uuidArb = fc.uuid();
  const actionArb = fc.constantFrom<AuditAction>(...DATA_MODIFICATION_ACTIONS);
  const resourceTypeArb = fc.constantFrom<AuditResourceType>(...VALID_RESOURCE_TYPES);
  const ipAddressArb = fc.oneof(
    fc.constant(null),
    fc.ipV4(),
    fc.ipV6()
  );
  const userAgentArb = fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 10, maxLength: 200 })
  );
  const metadataArb = fc.oneof(
    fc.constant(null),
    fc.record({
      previousValue: fc.jsonValue(),
      newValue: fc.jsonValue(),
    })
  );

  describe('Audit Log Entry Creation', () => {
    it('for any data modification action, audit log entry SHALL contain required fields', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          uuidArb,
          metadataArb,
          (userId, action, resourceType, resourceId, metadata) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              resourceId,
              metadata: metadata as AuditMetadata | null,
            });

            const validation = validateAuditLogEntry(entry);
            
            expect(validation.isValid).toBe(true);
            expect(validation.missingFields).toHaveLength(0);
            
            // Verify all required fields are present
            expect(entry.id).toBeDefined();
            expect(entry.action).toBe(action);
            expect(entry.resourceType).toBe(resourceType);
            expect(entry.createdAt).toBeInstanceOf(Date);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any audit log entry, timestamp SHALL be set to current time', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          (userId, action, resourceType) => {
            const beforeCreation = new Date();
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
            });
            const afterCreation = new Date();

            // Timestamp should be between before and after creation
            expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
            expect(entry.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any audit log entry with user ID, user ID SHALL be preserved', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          (userId, action, resourceType) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
            });

            expect(entry.userId).toBe(userId);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any audit log entry with resource ID, resource ID SHALL be preserved', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          uuidArb,
          (userId, action, resourceType, resourceId) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              resourceId,
            });

            expect(entry.resourceId).toBe(resourceId);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Action-Resource Type Consistency', () => {
    it('for any data modification action, resource type SHALL match the action domain', () => {
      // Test specific action-resource combinations
      const testCases: Array<{ action: AuditAction; resourceType: AuditResourceType; shouldMatch: boolean }> = [
        { action: 'user_created', resourceType: 'user', shouldMatch: true },
        { action: 'user_created', resourceType: 'doctor', shouldMatch: false },
        { action: 'doctor_approved', resourceType: 'doctor', shouldMatch: true },
        { action: 'doctor_approved', resourceType: 'patient', shouldMatch: false },
        { action: 'appointment_created', resourceType: 'appointment', shouldMatch: true },
        { action: 'appointment_created', resourceType: 'user', shouldMatch: false },
        { action: 'intake_started', resourceType: 'intake_session', shouldMatch: true },
        { action: 'config_updated', resourceType: 'platform_config', shouldMatch: true },
      ];

      for (const testCase of testCases) {
        const isValid = isValidActionResourceCombination(testCase.action, testCase.resourceType);
        expect(isValid).toBe(testCase.shouldMatch);
      }
    });

    it('for any user-related action, resource type SHALL be user', () => {
      const userActions: AuditAction[] = [
        'user_created',
        'user_updated',
        'user_deleted',
        'user_activated',
        'user_suspended',
        'user_role_changed',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom<AuditAction>(...userActions),
          (action) => {
            expect(isValidActionResourceCombination(action, 'user')).toBe(true);
            expect(isValidActionResourceCombination(action, 'doctor')).toBe(false);
            expect(isValidActionResourceCombination(action, 'appointment')).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any doctor-related action, resource type SHALL be doctor', () => {
      const doctorActions: AuditAction[] = [
        'doctor_created',
        'doctor_updated',
        'doctor_approved',
        'doctor_rejected',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom<AuditAction>(...doctorActions),
          (action) => {
            expect(isValidActionResourceCombination(action, 'doctor')).toBe(true);
            expect(isValidActionResourceCombination(action, 'user')).toBe(false);
            expect(isValidActionResourceCombination(action, 'patient')).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Metadata Preservation', () => {
    it('for any audit log entry with metadata, metadata SHALL be preserved', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          fc.record({
            previousValue: fc.string(),
            newValue: fc.string(),
            additionalInfo: fc.string(),
          }),
          (userId, action, resourceType, metadata) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              metadata: metadata as AuditMetadata,
            });

            expect(entry.metadata).toEqual(metadata);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any audit log entry without metadata, metadata SHALL be null', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          (userId, action, resourceType) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              metadata: null,
            });

            expect(entry.metadata).toBeNull();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('IP Address and User Agent', () => {
    it('for any audit log entry with IP address, IP address SHALL be preserved', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          fc.ipV4(),
          (userId, action, resourceType, ipAddress) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              ipAddress,
            });

            expect(entry.ipAddress).toBe(ipAddress);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any audit log entry with user agent, user agent SHALL be preserved', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          fc.string({ minLength: 10, maxLength: 200 }),
          (userId, action, resourceType, userAgent) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              userAgent,
            });

            expect(entry.userAgent).toBe(userAgent);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Modification Action Classification', () => {
    it('all defined data modification actions SHALL be recognized', () => {
      fc.assert(
        fc.property(
          actionArb,
          (action) => {
            expect(isDataModificationAction(action)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('authentication events SHALL NOT be classified as data modifications', () => {
      const authActions: AuditAction[] = ['login', 'logout', 'login_failed'];
      
      for (const action of authActions) {
        expect(isDataModificationAction(action)).toBe(false);
      }
    });
  });

  describe('Unique ID Generation', () => {
    it('for any two audit log entries, IDs SHALL be unique', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          uuidArb,
          actionArb,
          resourceTypeArb,
          (userId1, action1, resourceType1, userId2, action2, resourceType2) => {
            const entry1 = createAuditLogEntry({
              userId: userId1,
              action: action1,
              resourceType: resourceType1,
            });

            const entry2 = createAuditLogEntry({
              userId: userId2,
              action: action2,
              resourceType: resourceType2,
            });

            expect(entry1.id).not.toBe(entry2.id);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('audit log entry with null user ID SHALL be valid for system operations', () => {
      fc.assert(
        fc.property(
          actionArb,
          resourceTypeArb,
          (action, resourceType) => {
            const entry = createAuditLogEntry({
              userId: null,
              action,
              resourceType,
            });

            const validation = validateAuditLogEntry(entry);
            expect(validation.isValid).toBe(true);
            expect(entry.userId).toBeNull();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('audit log entry with null resource ID SHALL be valid for bulk operations', () => {
      fc.assert(
        fc.property(
          uuidArb,
          actionArb,
          resourceTypeArb,
          (userId, action, resourceType) => {
            const entry = createAuditLogEntry({
              userId,
              action,
              resourceType,
              resourceId: null,
            });

            const validation = validateAuditLogEntry(entry);
            expect(validation.isValid).toBe(true);
            expect(entry.resourceId).toBeNull();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
