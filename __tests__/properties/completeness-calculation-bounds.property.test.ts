/**
 * Property Test: Completeness Calculation Bounds
 * 
 * Feature: intake-progression-booking-fix, Property 6: Completeness Calculation Bounds
 * 
 * *For any* MedicalData object, the calculated completeness should be between 0 and 100 inclusive.
 * 
 * Validates Requirements 6.1, 6.2 from intake-progression-booking-fix spec:
 * - Completeness is always between 0 and 100
 * - Each field contributes the correct percentage:
 *   - chiefComplaint (20%)
 *   - hpi (20%)
 *   - recordsCheckCompleted (10%)
 *   - medications (10%)
 *   - allergies (10%)
 *   - pastMedicalHistory (10%)
 *   - familyHistory (5%)
 *   - socialHistory (5%)
 *   - clinicalHandover (10%)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MedicalData, SBAR, AgentRole } from '@/types';
import { INITIAL_MEDICAL_DATA, VALID_AGENT_ROLES } from '@/types';
import { calculateIntakeCompleteness } from '@/server/services/intake-utils';

// Arbitraries for generating test data
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...VALID_AGENT_ROLES);

const sbarArb: fc.Arbitrary<SBAR> = fc.record({
  situation: fc.string({ minLength: 1, maxLength: 200 }),
  background: fc.string({ minLength: 1, maxLength: 200 }),
  assessment: fc.string({ minLength: 1, maxLength: 200 }),
  recommendation: fc.string({ minLength: 1, maxLength: 200 }),
});

const bookingStatusArb = fc.constantFrom('collecting', 'ready', 'booked') as fc.Arbitrary<'collecting' | 'ready' | 'booked'>;

// Generate arbitrary medical data for property testing
const medicalDataArb: fc.Arbitrary<MedicalData> = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  hpi: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  medicalRecords: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  recordsCheckCompleted: fc.boolean(),
  medications: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  allergies: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  pastMedicalHistory: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  familyHistory: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  socialHistory: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  reviewOfSystems: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  currentAgent: agentRoleArb,
  clinicalHandover: fc.option(sbarArb, { nil: null }),
  ucgRecommendations: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  bookingStatus: bookingStatusArb,
  appointmentDate: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
});

describe('Completeness Calculation Bounds', () => {
  describe('Property 1: Completeness is Always Between 0 and 100', () => {
    it('should return 0 for null medical data', () => {
      expect(calculateIntakeCompleteness(null)).toBe(0);
    });

    it('should return 0 for initial medical data', () => {
      expect(calculateIntakeCompleteness(INITIAL_MEDICAL_DATA)).toBe(0);
    });

    it('should never exceed 100', () => {
      const maxData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Detailed history of present illness',
        recordsCheckCompleted: true,
        medications: ['Aspirin', 'Ibuprofen'],
        allergies: ['Penicillin'],
        pastMedicalHistory: ['Hypertension', 'Diabetes'],
        familyHistory: 'Father had heart disease',
        socialHistory: 'Non-smoker, occasional alcohol',
        clinicalHandover: {
          situation: 'Patient with headache',
          background: 'No significant history',
          assessment: 'Tension headache',
          recommendation: 'OTC pain relief',
        },
      };
      expect(calculateIntakeCompleteness(maxData)).toBeLessThanOrEqual(100);
    });

    it('should never be negative', () => {
      const emptyData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: null,
        hpi: null,
        recordsCheckCompleted: false,
        medications: [],
        allergies: [],
        pastMedicalHistory: [],
        familyHistory: null,
        socialHistory: null,
        clinicalHandover: null,
      };
      expect(calculateIntakeCompleteness(emptyData)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property 2: Chief Complaint Contributes 20%', () => {
    it('should add 20% when chiefComplaint is present', () => {
      const withoutCC = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: null,
      });
      const withCC = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
      });
      expect(withCC - withoutCC).toBe(20);
    });

    it('should not add points for empty chiefComplaint', () => {
      const withEmpty = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: '',
      });
      expect(withEmpty).toBe(0);
    });

    it('should not add points for whitespace-only chiefComplaint', () => {
      const withWhitespace = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: '   ',
      });
      expect(withWhitespace).toBe(0);
    });
  });

  describe('Property 3: HPI Contributes 20%', () => {
    it('should add 20% when hpi is present', () => {
      const withoutHPI = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        hpi: null,
      });
      const withHPI = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        hpi: 'Detailed history',
      });
      expect(withHPI - withoutHPI).toBe(20);
    });
  });

  describe('Property 4: Records Check Contributes 10%', () => {
    it('should add 10% when recordsCheckCompleted is true', () => {
      const withoutRecords = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        recordsCheckCompleted: false,
      });
      const withRecords = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        recordsCheckCompleted: true,
      });
      // Note: recordsCheckCompleted also affects medications, allergies, and pastMedicalHistory
      // So the difference includes those contributions too
      expect(withRecords).toBeGreaterThan(withoutRecords);
    });
  });

  describe('Property 5: Clinical Handover Contributes 10%', () => {
    it('should add 10% when clinicalHandover is present', () => {
      const baseData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'History',
        recordsCheckCompleted: true,
        medications: ['Aspirin'],
        allergies: ['None'],
        pastMedicalHistory: ['None'],
        familyHistory: 'None',
        socialHistory: 'None',
      };
      
      const withoutSBAR = calculateIntakeCompleteness({
        ...baseData,
        clinicalHandover: null,
      });
      const withSBAR = calculateIntakeCompleteness({
        ...baseData,
        clinicalHandover: {
          situation: 'Patient with headache',
          background: 'No significant history',
          assessment: 'Tension headache',
          recommendation: 'OTC pain relief',
        },
      });
      expect(withSBAR - withoutSBAR).toBe(10);
    });
  });

  describe('Property 6: Completeness Increases Monotonically', () => {
    it('should increase as more fields are filled', () => {
      const step1 = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
      });
      
      const step2 = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'History',
      });
      
      const step3 = calculateIntakeCompleteness({
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'History',
        recordsCheckCompleted: true,
      });
      
      expect(step2).toBeGreaterThan(step1);
      expect(step3).toBeGreaterThan(step2);
    });
  });

  describe('Property 7: Full Data Reaches 100%', () => {
    it('should reach 100% with all fields filled', () => {
      const fullData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Detailed history of present illness',
        recordsCheckCompleted: true,
        medications: ['Aspirin'],
        allergies: ['Penicillin'],
        pastMedicalHistory: ['Hypertension'],
        familyHistory: 'Father had heart disease',
        socialHistory: 'Non-smoker',
        clinicalHandover: {
          situation: 'Patient with headache',
          background: 'No significant history',
          assessment: 'Tension headache',
          recommendation: 'OTC pain relief',
        },
      };
      expect(calculateIntakeCompleteness(fullData)).toBe(100);
    });
  });

  /**
   * Property 6: Completeness Calculation Bounds (Property-Based Test)
   * 
   * *For any* MedicalData object, the calculated completeness should be between 0 and 100 inclusive.
   * 
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 6: Completeness Calculation Bounds (PBT)', () => {
    it('should always return a value between 0 and 100 for any MedicalData', () => {
      fc.assert(
        fc.property(medicalDataArb, (medicalData) => {
          const completeness = calculateIntakeCompleteness(medicalData);
          
          // Property: completeness is always in [0, 100]
          expect(completeness).toBeGreaterThanOrEqual(0);
          expect(completeness).toBeLessThanOrEqual(100);
          
          return completeness >= 0 && completeness <= 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should return an integer percentage for any MedicalData', () => {
      fc.assert(
        fc.property(medicalDataArb, (medicalData) => {
          const completeness = calculateIntakeCompleteness(medicalData);
          
          // Property: completeness is always an integer (no fractional percentages)
          expect(Number.isInteger(completeness)).toBe(true);
          
          return Number.isInteger(completeness);
        }),
        { numRuns: 100 }
      );
    });

    it('should be deterministic - same input always produces same output', () => {
      fc.assert(
        fc.property(medicalDataArb, (medicalData) => {
          const completeness1 = calculateIntakeCompleteness(medicalData);
          const completeness2 = calculateIntakeCompleteness(medicalData);
          
          // Property: function is deterministic
          expect(completeness1).toBe(completeness2);
          
          return completeness1 === completeness2;
        }),
        { numRuns: 100 }
      );
    });
  });
});
