/**
 * Property Test: Medical Data Merge Preserves Existing Values
 * 
 * **Property 9: Medical Data Merge Preserves Existing Values**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * For any merge of existing MedicalData with partial updates, fields not present 
 * in the update should retain their original values.
 * 
 * - Null/undefined updates don't overwrite existing values
 * - bookingStatus is properly merged
 * - clinicalHandover is properly merged
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MedicalData, AgentRole, SBAR } from '@/types';
import { INITIAL_MEDICAL_DATA, VALID_AGENT_ROLES } from '@/types';
import { mergeMedicalData } from '@/server/services/intake-utils';

// Arbitraries for generating test data
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...VALID_AGENT_ROLES);

const sbarArb: fc.Arbitrary<SBAR> = fc.record({
  situation: fc.string({ minLength: 1, maxLength: 100 }),
  background: fc.string({ minLength: 1, maxLength: 100 }),
  assessment: fc.string({ minLength: 1, maxLength: 100 }),
  recommendation: fc.string({ minLength: 1, maxLength: 100 }),
});

const bookingStatusArb = fc.constantFrom('collecting', 'ready', 'booked') as fc.Arbitrary<'collecting' | 'ready' | 'booked'>;

const stringArrayArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 });

const medicalDataArb: fc.Arbitrary<MedicalData> = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  hpi: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  medicalRecords: stringArrayArb,
  recordsCheckCompleted: fc.boolean(),
  medications: stringArrayArb,
  allergies: stringArrayArb,
  pastMedicalHistory: stringArrayArb,
  familyHistory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  socialHistory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  reviewOfSystems: stringArrayArb,
  currentAgent: agentRoleArb,
  clinicalHandover: fc.option(sbarArb, { nil: null }),
  ucgRecommendations: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  bookingStatus: bookingStatusArb,
  appointmentDate: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

// Arbitrary for partial updates (fields may or may not be present)
const partialMedicalDataArb: fc.Arbitrary<Partial<MedicalData>> = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  hpi: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  medicalRecords: fc.option(stringArrayArb, { nil: undefined }),
  recordsCheckCompleted: fc.option(fc.boolean(), { nil: undefined }),
  medications: fc.option(stringArrayArb, { nil: undefined }),
  allergies: fc.option(stringArrayArb, { nil: undefined }),
  pastMedicalHistory: fc.option(stringArrayArb, { nil: undefined }),
  familyHistory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  socialHistory: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  reviewOfSystems: fc.option(stringArrayArb, { nil: undefined }),
  currentAgent: fc.option(agentRoleArb, { nil: undefined }),
  clinicalHandover: fc.option(sbarArb, { nil: undefined }),
  ucgRecommendations: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  bookingStatus: fc.option(bookingStatusArb, { nil: undefined }),
  appointmentDate: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

describe('Medical Data Merge Preserves Existing Values', () => {
  /**
   * Property 9: Medical Data Merge Preserves Existing Values
   * 
   * For any merge of existing MedicalData with partial updates, fields not present 
   * in the update should retain their original values.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  describe('Property 9: Fields Not In Update Retain Original Values (PBT)', () => {
    it('for any MedicalData and partial update, fields not in update should be preserved', () => {
      fc.assert(
        fc.property(
          medicalDataArb,
          partialMedicalDataArb,
          (existing, update) => {
            const result = mergeMedicalData(existing, update);
            
            // For each field, if it's not in the update (undefined), it should retain original value
            const fields: (keyof MedicalData)[] = [
              'chiefComplaint', 'hpi', 'medicalRecords', 'recordsCheckCompleted',
              'medications', 'allergies', 'pastMedicalHistory', 'familyHistory',
              'socialHistory', 'reviewOfSystems', 'currentAgent', 'clinicalHandover',
              'ucgRecommendations', 'bookingStatus', 'appointmentDate'
            ];
            
            for (const field of fields) {
              if (update[field] === undefined) {
                // Field not in update - should preserve existing value
                expect(result[field]).toEqual(existing[field]);
              } else {
                // Field in update - should use update value
                expect(result[field]).toEqual(update[field]);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any MedicalData, merging with empty update should return equivalent data', () => {
      fc.assert(
        fc.property(
          medicalDataArb,
          (existing) => {
            const emptyUpdate: Partial<MedicalData> = {};
            const result = mergeMedicalData(existing, emptyUpdate);
            
            // All fields should be preserved
            expect(result.chiefComplaint).toEqual(existing.chiefComplaint);
            expect(result.hpi).toEqual(existing.hpi);
            expect(result.medicalRecords).toEqual(existing.medicalRecords);
            expect(result.recordsCheckCompleted).toEqual(existing.recordsCheckCompleted);
            expect(result.medications).toEqual(existing.medications);
            expect(result.allergies).toEqual(existing.allergies);
            expect(result.pastMedicalHistory).toEqual(existing.pastMedicalHistory);
            expect(result.familyHistory).toEqual(existing.familyHistory);
            expect(result.socialHistory).toEqual(existing.socialHistory);
            expect(result.reviewOfSystems).toEqual(existing.reviewOfSystems);
            expect(result.currentAgent).toEqual(existing.currentAgent);
            expect(result.clinicalHandover).toEqual(existing.clinicalHandover);
            expect(result.ucgRecommendations).toEqual(existing.ucgRecommendations);
            expect(result.bookingStatus).toEqual(existing.bookingStatus);
            expect(result.appointmentDate).toEqual(existing.appointmentDate);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any MedicalData, bookingStatus update should be applied while preserving other fields', () => {
      fc.assert(
        fc.property(
          medicalDataArb,
          bookingStatusArb,
          (existing, newBookingStatus) => {
            const update: Partial<MedicalData> = { bookingStatus: newBookingStatus };
            const result = mergeMedicalData(existing, update);
            
            // bookingStatus should be updated
            expect(result.bookingStatus).toBe(newBookingStatus);
            
            // All other fields should be preserved
            expect(result.chiefComplaint).toEqual(existing.chiefComplaint);
            expect(result.hpi).toEqual(existing.hpi);
            expect(result.medications).toEqual(existing.medications);
            expect(result.clinicalHandover).toEqual(existing.clinicalHandover);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any MedicalData, clinicalHandover update should be applied while preserving other fields', () => {
      fc.assert(
        fc.property(
          medicalDataArb,
          sbarArb,
          (existing, newSbar) => {
            const update: Partial<MedicalData> = { clinicalHandover: newSbar };
            const result = mergeMedicalData(existing, update);
            
            // clinicalHandover should be updated
            expect(result.clinicalHandover).toEqual(newSbar);
            
            // All other fields should be preserved
            expect(result.chiefComplaint).toEqual(existing.chiefComplaint);
            expect(result.hpi).toEqual(existing.hpi);
            expect(result.bookingStatus).toEqual(existing.bookingStatus);
            expect(result.medications).toEqual(existing.medications);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1: Null Updates Do Not Overwrite', () => {
    it('should preserve chiefComplaint when update is null', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
      };
      const update: Partial<MedicalData> = {
        chiefComplaint: null as any,
      };
      const result = mergeMedicalData(existing, update);
      expect(result.chiefComplaint).toBe('Headache');
    });

    it('should preserve hpi when update is undefined', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        hpi: 'Detailed history',
      };
      const update: Partial<MedicalData> = {};
      const result = mergeMedicalData(existing, update);
      expect(result.hpi).toBe('Detailed history');
    });
  });

  describe('Property 2: Non-Null Updates Overwrite', () => {
    it('should update chiefComplaint when new value provided', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
      };
      const update: Partial<MedicalData> = {
        chiefComplaint: 'Chest pain',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.chiefComplaint).toBe('Chest pain');
    });

    it('should update hpi when new value provided', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        hpi: 'Old history',
      };
      const update: Partial<MedicalData> = {
        hpi: 'New detailed history',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.hpi).toBe('New detailed history');
    });
  });

  describe('Property 3: bookingStatus is Properly Merged', () => {
    it('should preserve bookingStatus when update is null', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'ready',
      };
      const update: Partial<MedicalData> = {
        bookingStatus: null as any,
      };
      const result = mergeMedicalData(existing, update);
      expect(result.bookingStatus).toBe('ready');
    });

    it('should update bookingStatus from collecting to ready', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'collecting',
      };
      const update: Partial<MedicalData> = {
        bookingStatus: 'ready',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.bookingStatus).toBe('ready');
    });

    it('should preserve bookingStatus when not in update', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'ready',
      };
      const update: Partial<MedicalData> = {
        chiefComplaint: 'New complaint',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.bookingStatus).toBe('ready');
    });
  });

  describe('Property 4: clinicalHandover is Properly Merged', () => {
    it('should preserve clinicalHandover when update is null', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        clinicalHandover: {
          situation: 'Patient with headache',
          background: 'No history',
          assessment: 'Tension headache',
          recommendation: 'OTC pain relief',
        },
      };
      const update: Partial<MedicalData> = {
        clinicalHandover: null as any,
      };
      const result = mergeMedicalData(existing, update);
      expect(result.clinicalHandover).toEqual(existing.clinicalHandover);
    });

    it('should update clinicalHandover when new value provided', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        clinicalHandover: null,
      };
      const newSBAR = {
        situation: 'New situation',
        background: 'New background',
        assessment: 'New assessment',
        recommendation: 'New recommendation',
      };
      const update: Partial<MedicalData> = {
        clinicalHandover: newSBAR,
      };
      const result = mergeMedicalData(existing, update);
      expect(result.clinicalHandover).toEqual(newSBAR);
    });
  });

  describe('Property 5: Arrays are Properly Merged', () => {
    it('should preserve medications when update is null', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        medications: ['Aspirin', 'Ibuprofen'],
      };
      const update: Partial<MedicalData> = {
        medications: null as any,
      };
      const result = mergeMedicalData(existing, update);
      expect(result.medications).toEqual(['Aspirin', 'Ibuprofen']);
    });

    it('should update medications when new array provided', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        medications: ['Aspirin'],
      };
      const update: Partial<MedicalData> = {
        medications: ['Aspirin', 'Ibuprofen', 'Tylenol'],
      };
      const result = mergeMedicalData(existing, update);
      expect(result.medications).toEqual(['Aspirin', 'Ibuprofen', 'Tylenol']);
    });

    it('should allow setting empty array', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        medications: ['Aspirin'],
      };
      const update: Partial<MedicalData> = {
        medications: [],
      };
      const result = mergeMedicalData(existing, update);
      expect(result.medications).toEqual([]);
    });
  });

  describe('Property 6: Multiple Fields Can Be Updated Simultaneously', () => {
    it('should update multiple fields at once', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Old complaint',
        hpi: 'Old history',
        bookingStatus: 'collecting',
      };
      const update: Partial<MedicalData> = {
        chiefComplaint: 'New complaint',
        hpi: 'New history',
        bookingStatus: 'ready',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.chiefComplaint).toBe('New complaint');
      expect(result.hpi).toBe('New history');
      expect(result.bookingStatus).toBe('ready');
    });

    it('should preserve fields not in update while updating others', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'History',
        medications: ['Aspirin'],
        bookingStatus: 'collecting',
      };
      const update: Partial<MedicalData> = {
        bookingStatus: 'ready',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.chiefComplaint).toBe('Headache');
      expect(result.hpi).toBe('History');
      expect(result.medications).toEqual(['Aspirin']);
      expect(result.bookingStatus).toBe('ready');
    });
  });

  describe('Property 7: currentAgent is Properly Merged', () => {
    it('should update currentAgent when provided', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        currentAgent: 'Triage',
      };
      const update: Partial<MedicalData> = {
        currentAgent: 'ClinicalInvestigator',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.currentAgent).toBe('ClinicalInvestigator');
    });

    it('should preserve currentAgent when not in update', () => {
      const existing: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        currentAgent: 'HandoverSpecialist',
      };
      const update: Partial<MedicalData> = {
        chiefComplaint: 'New complaint',
      };
      const result = mergeMedicalData(existing, update);
      expect(result.currentAgent).toBe('HandoverSpecialist');
    });
  });
});
