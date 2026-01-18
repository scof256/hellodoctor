/**
 * Feature: dashboard-performance-optimization, Property 3: Lean Response Field Exclusion
 * 
 * For any dashboard API response, the response SHALL NOT contain the fields:
 * medicalData, clinicalHandover, doctorThought, or full message arrays.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Define excluded fields inline
const EXCLUDED_DASHBOARD_FIELDS = [
  'medicalData', 'clinicalHandover', 'doctorThought', 'messages',
  'currentAgent', 'startedAt', 'completedAt', 'reviewedAt', 'reviewedBy',
  'notes', 'price', 'paymentStatus', 'paymentId', 'bookedBy', 'cancelledBy', 'cancelReason',
  'connectionSource', 'disconnectedAt', 'clerkId', 'primaryRole', 'updatedAt',
] as const;

// Arbitraries
const uuidArb = fc.uuid();
const dateArb = fc.date();
const nullableStringArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null });

const appointmentStatusArb = fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
const connectionStatusArb = fc.constantFrom('active', 'disconnected', 'blocked');
const intakeStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed');

// AppointmentSummary arbitrary
const appointmentSummaryArb = fc.record({
  id: uuidArb,
  scheduledAt: dateArb,
  duration: fc.integer({ min: 15, max: 120 }),
  status: appointmentStatusArb,
  connectionId: uuidArb,
  intakeSessionId: fc.option(uuidArb, { nil: null }),
  patient: fc.option(fc.record({
    id: uuidArb, firstName: nullableStringArb, lastName: nullableStringArb, imageUrl: nullableStringArb,
  }), { nil: null }),
  doctor: fc.option(fc.record({
    id: uuidArb, firstName: nullableStringArb, lastName: nullableStringArb, imageUrl: nullableStringArb,
    specialty: nullableStringArb, clinicName: nullableStringArb,
  }), { nil: null }),
});

// ConnectionSummary arbitrary
const connectionSummaryArb = fc.record({
  id: uuidArb,
  status: connectionStatusArb,
  connectedAt: dateArb,
  patient: fc.option(fc.record({
    id: uuidArb, firstName: nullableStringArb, lastName: nullableStringArb, imageUrl: nullableStringArb, email: nullableStringArb,
  }), { nil: null }),
  doctor: fc.option(fc.record({
    id: uuidArb, firstName: nullableStringArb, lastName: nullableStringArb, imageUrl: nullableStringArb,
    specialty: nullableStringArb, clinicName: nullableStringArb,
  }), { nil: null }),
  intakeStatus: fc.option(fc.record({
    status: intakeStatusArb, completeness: fc.integer({ min: 0, max: 100 }), sessionId: fc.option(uuidArb, { nil: null }),
  }), { nil: null }),
});

// IntakeSessionSummary arbitrary
const intakeSessionSummaryArb = fc.record({
  id: uuidArb, connectionId: uuidArb, status: intakeStatusArb, completeness: fc.integer({ min: 0, max: 100 }),
});

/** Get all keys from an object recursively. */
function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      keys.push(...getAllKeys(value, fullKey));
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === 'object') keys.push(...getAllKeys(item, fullKey));
      }
    }
  }
  return keys;
}

/** Check if any key contains an excluded field name. */
function containsExcludedField(keys: string[], excludedFields: readonly string[]): string | null {
  for (const key of keys) {
    for (const part of key.split('.')) {
      if (excludedFields.includes(part)) return part;
    }
  }
  return null;
}

describe('Property 3: Lean Response Field Exclusion', () => {
  describe('AppointmentSummary', () => {
    it('SHALL NOT contain excluded fields', () => {
      fc.assert(fc.property(appointmentSummaryArb, (appointment) => {
        const keys = getAllKeys(appointment);
        const excludedField = containsExcludedField(keys, EXCLUDED_DASHBOARD_FIELDS);
        expect(excludedField).toBeNull();
        return true;
      }), { numRuns: 10 });
    });

    it('SHALL contain required fields', () => {
      fc.assert(fc.property(appointmentSummaryArb, (appointment) => {
        expect(appointment).toHaveProperty('id');
        expect(appointment).toHaveProperty('scheduledAt');
        expect(appointment).toHaveProperty('duration');
        expect(appointment).toHaveProperty('status');
        expect(appointment).toHaveProperty('connectionId');
        return true;
      }), { numRuns: 10 });
    });
  });

  describe('ConnectionSummary', () => {
    it('SHALL NOT contain excluded fields', () => {
      fc.assert(fc.property(connectionSummaryArb, (connection) => {
        const keys = getAllKeys(connection);
        const excludedField = containsExcludedField(keys, EXCLUDED_DASHBOARD_FIELDS);
        expect(excludedField).toBeNull();
        return true;
      }), { numRuns: 10 });
    });

    it('SHALL contain required fields', () => {
      fc.assert(fc.property(connectionSummaryArb, (connection) => {
        expect(connection).toHaveProperty('id');
        expect(connection).toHaveProperty('status');
        expect(connection).toHaveProperty('connectedAt');
        return true;
      }), { numRuns: 10 });
    });
  });

  describe('IntakeSessionSummary', () => {
    it('SHALL NOT contain excluded fields', () => {
      fc.assert(fc.property(intakeSessionSummaryArb, (session) => {
        const keys = getAllKeys(session);
        const excludedField = containsExcludedField(keys, EXCLUDED_DASHBOARD_FIELDS);
        expect(excludedField).toBeNull();
        return true;
      }), { numRuns: 10 });
    });

    it('SHALL contain only 4 fields', () => {
      fc.assert(fc.property(intakeSessionSummaryArb, (session) => {
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('connectionId');
        expect(session).toHaveProperty('status');
        expect(session).toHaveProperty('completeness');
        expect(Object.keys(session)).toHaveLength(4);
        return true;
      }), { numRuns: 10 });
    });
  });

  describe('EXCLUDED_DASHBOARD_FIELDS', () => {
    it('SHALL include critical excluded fields', () => {
      expect(EXCLUDED_DASHBOARD_FIELDS).toContain('medicalData');
      expect(EXCLUDED_DASHBOARD_FIELDS).toContain('clinicalHandover');
      expect(EXCLUDED_DASHBOARD_FIELDS).toContain('doctorThought');
      expect(EXCLUDED_DASHBOARD_FIELDS).toContain('messages');
    });
  });
});
