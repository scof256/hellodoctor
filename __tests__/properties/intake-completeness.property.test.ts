/**
 * Feature: doctor-appointment-saas, Property 10: Intake Completeness Calculation
 * 
 * For any intake session, the completeness percentage SHALL equal the ratio of 
 * filled required fields to total required fields, and SHALL be recalculated 
 * after each medical data update.
 * 
 * Validates: Requirements 7.1, 7.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MedicalData, SBAR, AgentRole } from '@/app/types';
import { VALID_AGENT_ROLES } from '@/app/types';
import { calculateIntakeCompleteness, mergeMedicalData } from '@/server/services/intake-utils';

// Arbitraries for generating test data
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...VALID_AGENT_ROLES);

const sbarArb: fc.Arbitrary<SBAR> = fc.record({
  situation: fc.string({ minLength: 1, maxLength: 200 }),
  background: fc.string({ minLength: 1, maxLength: 200 }),
  assessment: fc.string({ minLength: 1, maxLength: 200 }),
  recommendation: fc.string({ minLength: 1, maxLength: 200 }),
});

const bookingStatusArb = fc.constantFrom('collecting', 'ready', 'booked') as fc.Arbitrary<'collecting' | 'ready' | 'booked'>;

// Generate medical data with controlled field presence
const medicalDataArb: fc.Arbitrary<MedicalData> = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  hpi: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  medicalRecords: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  recordsCheckCompleted: fc.boolean(),
  medications: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  allergies: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  pastMedicalHistory: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  familyHistory: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  socialHistory: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  reviewOfSystems: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  currentAgent: agentRoleArb,
  clinicalHandover: fc.option(sbarArb, { nil: null }),
  ucgRecommendations: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  bookingStatus: bookingStatusArb,
  appointmentDate: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
});

// Helper to calculate expected completeness based on field presence
function calculateExpectedCompleteness(data: MedicalData): number {
  let completeness = 0;

  // Chief Complaint (20%)
  if (data.chiefComplaint && data.chiefComplaint.trim().length > 0) {
    completeness += 20;
  }

  // HPI (20%)
  if (data.hpi && data.hpi.trim().length > 0) {
    completeness += 20;
  }

  // Records Check (10%)
  if (data.recordsCheckCompleted) {
    completeness += 10;
  }

  // Medications (10%) - either has meds or records check completed
  if (data.medications.length > 0 || data.recordsCheckCompleted) {
    completeness += 10;
  }

  // Allergies (10%) - either has allergies or records check completed
  if (data.allergies.length > 0 || data.recordsCheckCompleted) {
    completeness += 10;
  }

  // Past Medical History (10%) - either has PMH or records check completed
  if (data.pastMedicalHistory.length > 0 || data.recordsCheckCompleted) {
    completeness += 10;
  }

  // Family History (5%)
  if (data.familyHistory && data.familyHistory.trim().length > 0) {
    completeness += 5;
  }

  // Social History (5%)
  if (data.socialHistory && data.socialHistory.trim().length > 0) {
    completeness += 5;
  }

  // Clinical Handover (10%)
  if (data.clinicalHandover) {
    completeness += 10;
  }

  return Math.min(completeness, 100);
}

describe('Property 10: Intake Completeness Calculation', () => {
  it('should calculate completeness as ratio of filled fields to total fields', () => {
    fc.assert(
      fc.property(medicalDataArb, (medicalData) => {
        const actualCompleteness = calculateIntakeCompleteness(medicalData);
        const expectedCompleteness = calculateExpectedCompleteness(medicalData);
        
        expect(actualCompleteness).toBe(expectedCompleteness);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return 0 for null medical data', () => {
    const completeness = calculateIntakeCompleteness(null);
    expect(completeness).toBe(0);
  });

  it('should return 0 for empty medical data', () => {
    const emptyData: MedicalData = {
      chiefComplaint: null,
      hpi: null,
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: null,
      socialHistory: null,
      reviewOfSystems: [],
      currentAgent: 'Triage',
      clinicalHandover: null,
      ucgRecommendations: null,
      bookingStatus: 'collecting',
    };
    
    const completeness = calculateIntakeCompleteness(emptyData);
    expect(completeness).toBe(0);
  });

  it('should return 100 for fully complete medical data', () => {
    const completeData: MedicalData = {
      chiefComplaint: 'Headache for 3 days',
      hpi: 'Patient reports severe headache starting 3 days ago...',
      medicalRecords: ['Previous MRI scan'],
      recordsCheckCompleted: true,
      medications: ['Ibuprofen 400mg'],
      allergies: ['Penicillin'],
      pastMedicalHistory: ['Hypertension'],
      familyHistory: 'Father had migraines',
      socialHistory: 'Non-smoker, occasional alcohol',
      reviewOfSystems: ['No fever', 'No nausea'],
      currentAgent: 'HandoverSpecialist',
      clinicalHandover: {
        situation: 'Patient with chronic headache',
        background: 'History of migraines',
        assessment: 'Likely tension headache',
        recommendation: 'Consider CT scan',
      },
      ucgRecommendations: 'Follow Uganda Clinical Guidelines for headache',
      bookingStatus: 'ready',
    };
    
    const completeness = calculateIntakeCompleteness(completeData);
    expect(completeness).toBe(100);
  });

  it('should never exceed 100%', () => {
    fc.assert(
      fc.property(medicalDataArb, (medicalData) => {
        const completeness = calculateIntakeCompleteness(medicalData);
        expect(completeness).toBeLessThanOrEqual(100);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should never be negative', () => {
    fc.assert(
      fc.property(medicalDataArb, (medicalData) => {
        const completeness = calculateIntakeCompleteness(medicalData);
        expect(completeness).toBeGreaterThanOrEqual(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should be recalculated correctly after medical data updates', () => {
    fc.assert(
      fc.property(
        medicalDataArb,
        fc.record({
          chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          hpi: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          recordsCheckCompleted: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (originalData, update) => {
          // Calculate initial completeness
          const initialCompleteness = calculateIntakeCompleteness(originalData);
          
          // Merge update into original data
          const updatedData = mergeMedicalData(originalData, update as Partial<MedicalData>);
          
          // Calculate new completeness
          const newCompleteness = calculateIntakeCompleteness(updatedData);
          
          // Verify the new completeness matches expected calculation
          const expectedNewCompleteness = calculateExpectedCompleteness(updatedData);
          expect(newCompleteness).toBe(expectedNewCompleteness);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase completeness when adding chief complaint', () => {
    const dataWithoutComplaint: MedicalData = {
      chiefComplaint: null,
      hpi: null,
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: null,
      socialHistory: null,
      reviewOfSystems: [],
      currentAgent: 'Triage',
      clinicalHandover: null,
      ucgRecommendations: null,
      bookingStatus: 'collecting',
    };
    
    const dataWithComplaint = mergeMedicalData(dataWithoutComplaint, {
      chiefComplaint: 'Headache',
    });
    
    const beforeCompleteness = calculateIntakeCompleteness(dataWithoutComplaint);
    const afterCompleteness = calculateIntakeCompleteness(dataWithComplaint);
    
    expect(afterCompleteness).toBeGreaterThan(beforeCompleteness);
    expect(afterCompleteness - beforeCompleteness).toBe(20); // Chief complaint is worth 20%
  });

  it('should handle whitespace-only strings as empty', () => {
    const dataWithWhitespace: MedicalData = {
      chiefComplaint: '   ',
      hpi: '\t\n',
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: '  ',
      socialHistory: '\n',
      reviewOfSystems: [],
      currentAgent: 'Triage',
      clinicalHandover: null,
      ucgRecommendations: null,
      bookingStatus: 'collecting',
    };
    
    const completeness = calculateIntakeCompleteness(dataWithWhitespace);
    expect(completeness).toBe(0);
  });

  it('should count recordsCheckCompleted as contributing to multiple fields', () => {
    // When recordsCheckCompleted is true, it contributes to:
    // - Records Check (10%)
    // - Medications (10%) if no meds listed
    // - Allergies (10%) if no allergies listed
    // - Past Medical History (10%) if no PMH listed
    
    const dataWithRecordsCheck: MedicalData = {
      chiefComplaint: null,
      hpi: null,
      medicalRecords: [],
      recordsCheckCompleted: true,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: null,
      socialHistory: null,
      reviewOfSystems: [],
      currentAgent: 'RecordsClerk',
      clinicalHandover: null,
      ucgRecommendations: null,
      bookingStatus: 'collecting',
    };
    
    const completeness = calculateIntakeCompleteness(dataWithRecordsCheck);
    // Records check (10%) + Meds (10%) + Allergies (10%) + PMH (10%) = 40%
    expect(completeness).toBe(40);
  });

  it('should be monotonically non-decreasing when adding data', () => {
    // Adding data should never decrease completeness
    fc.assert(
      fc.property(
        medicalDataArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (originalData, newValue) => {
          const initialCompleteness = calculateIntakeCompleteness(originalData);
          
          // Add chief complaint if missing
          if (!originalData.chiefComplaint) {
            const updatedData = mergeMedicalData(originalData, { chiefComplaint: newValue });
            const newCompleteness = calculateIntakeCompleteness(updatedData);
            expect(newCompleteness).toBeGreaterThanOrEqual(initialCompleteness);
          }
          
          // Add HPI if missing
          if (!originalData.hpi) {
            const updatedData = mergeMedicalData(originalData, { hpi: newValue });
            const newCompleteness = calculateIntakeCompleteness(updatedData);
            expect(newCompleteness).toBeGreaterThanOrEqual(initialCompleteness);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
