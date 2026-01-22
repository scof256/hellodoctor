import { describe, it, expect } from 'vitest';
import { INITIAL_MEDICAL_DATA } from '@/types';

/**
 * Unit tests for intake session initialization
 * Validates Requirements 1.1, 9.2 from intake-interface-enhancements spec
 */
describe('Intake Session Initialization', () => {
  describe('INITIAL_MEDICAL_DATA structure', () => {
    it('should have currentAgent set to VitalsTriageAgent', () => {
      expect(INITIAL_MEDICAL_DATA.currentAgent).toBe('VitalsTriageAgent');
    });

    it('should have vitalsData with vitalsStageCompleted set to false', () => {
      expect(INITIAL_MEDICAL_DATA.vitalsData).toBeDefined();
      expect(INITIAL_MEDICAL_DATA.vitalsData?.vitalsStageCompleted).toBe(false);
    });

    it('should have vitalsData with proper null values for optional fields', () => {
      expect(INITIAL_MEDICAL_DATA.vitalsData).toMatchObject({
        patientName: null,
        patientAge: null,
        patientGender: null,
        vitalsCollected: false,
        temperature: {
          value: null,
          unit: 'celsius',
          collectedAt: null
        },
        weight: {
          value: null,
          unit: 'kg',
          collectedAt: null
        },
        bloodPressure: {
          systolic: null,
          diastolic: null,
          collectedAt: null
        },
        currentStatus: null,
        triageDecision: 'pending',
        triageReason: null,
        triageFactors: [],
        vitalsStageCompleted: false
      });
    });

    it('should have triageDecision set to pending', () => {
      expect(INITIAL_MEDICAL_DATA.vitalsData?.triageDecision).toBe('pending');
    });

    it('should have vitalsCollected set to false', () => {
      expect(INITIAL_MEDICAL_DATA.vitalsData?.vitalsCollected).toBe(false);
    });
  });

  describe('Session initialization consistency', () => {
    it('should ensure new sessions start with VitalsTriageAgent', () => {
      // This validates that INITIAL_MEDICAL_DATA.currentAgent is the source of truth
      // for session initialization, ensuring all session creation points use it
      const expectedAgent = 'VitalsTriageAgent';
      expect(INITIAL_MEDICAL_DATA.currentAgent).toBe(expectedAgent);
    });

    it('should ensure vitalsStageCompleted is false for new sessions', () => {
      // This validates that new sessions will trigger vitals collection
      expect(INITIAL_MEDICAL_DATA.vitalsData?.vitalsStageCompleted).toBe(false);
    });
  });
});
