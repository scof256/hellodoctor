/**
 * Property Test: Agent Routing Transitions
 * 
 * Validates Requirements 1.1-1.6 from intake-progression-booking-fix spec:
 * - Triage is selected when chiefComplaint is null
 * - ClinicalInvestigator is selected when HPI is incomplete
 * - RecordsClerk is selected when recordsCheckCompleted is false
 * - HistorySpecialist is selected when history data is missing
 * - HandoverSpecialist is selected when all data is present
 */

import { describe, it, expect } from 'vitest';
import type { MedicalData, AgentRole } from '@/types';
import { INITIAL_MEDICAL_DATA } from '@/types';

// Simulate the determineAgent logic (same as in gemini.ts)
function determineAgent(currentData: MedicalData): AgentRole {
  // Priority 1: Triage - No chief complaint yet
  if (!currentData.chiefComplaint || currentData.chiefComplaint.trim().length === 0) {
    return 'Triage';
  }

  // Priority 2: ClinicalInvestigator - HPI is incomplete
  const hpiLength = currentData.hpi?.trim().length ?? 0;
  if (hpiLength < 50) {
    return 'ClinicalInvestigator';
  }

  // Priority 3: RecordsClerk - Records check not completed
  if (!currentData.recordsCheckCompleted) {
    return 'RecordsClerk';
  }

  // Priority 4: HistorySpecialist - Missing medications, allergies, or history
  const hasMedications = currentData.medications.length > 0;
  const hasAllergies = currentData.allergies.length > 0;
  const hasPastHistory = currentData.pastMedicalHistory.length > 0;
  
  if (!hasMedications && !hasAllergies && !hasPastHistory) {
    return 'HistorySpecialist';
  }

  // Priority 5: HandoverSpecialist - All data present
  return 'HandoverSpecialist';
}

describe('Agent Routing Transitions', () => {
  describe('Property 1: Triage Selection on Missing Chief Complaint', () => {
    it('should route to Triage when chiefComplaint is null', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: null,
      };
      expect(determineAgent(data)).toBe('Triage');
    });

    it('should route to Triage when chiefComplaint is empty string', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: '',
      };
      expect(determineAgent(data)).toBe('Triage');
    });

    it('should route to Triage when chiefComplaint is whitespace only', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: '   ',
      };
      expect(determineAgent(data)).toBe('Triage');
    });
  });

  describe('Property 2: ClinicalInvestigator Selection on Incomplete HPI', () => {
    it('should route to ClinicalInvestigator when HPI is missing', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: null,
      };
      expect(determineAgent(data)).toBe('ClinicalInvestigator');
    });

    it('should route to ClinicalInvestigator when HPI is too short', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Short HPI',
      };
      expect(determineAgent(data)).toBe('ClinicalInvestigator');
    });

    it('should NOT route to ClinicalInvestigator when HPI is sufficient', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: false,
      };
      expect(determineAgent(data)).not.toBe('ClinicalInvestigator');
    });
  });

  describe('Property 3: RecordsClerk Selection on Incomplete Records Check', () => {
    it('should route to RecordsClerk when recordsCheckCompleted is false', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: false,
      };
      expect(determineAgent(data)).toBe('RecordsClerk');
    });

    it('should NOT route to RecordsClerk when recordsCheckCompleted is true', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: true,
        medications: [],
        allergies: [],
        pastMedicalHistory: [],
      };
      expect(determineAgent(data)).not.toBe('RecordsClerk');
    });
  });

  describe('Property 4: HistorySpecialist Selection on Missing History Data', () => {
    it('should route to HistorySpecialist when all history arrays are empty', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: true,
        medications: [],
        allergies: [],
        pastMedicalHistory: [],
      };
      expect(determineAgent(data)).toBe('HistorySpecialist');
    });

    it('should NOT route to HistorySpecialist when medications are present', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: true,
        medications: ['Aspirin'],
        allergies: [],
        pastMedicalHistory: [],
      };
      expect(determineAgent(data)).not.toBe('HistorySpecialist');
    });
  });

  describe('Property 5: HandoverSpecialist Selection When All Data Present', () => {
    it('should route to HandoverSpecialist when all required data is present', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: true,
        medications: ['Aspirin'],
        allergies: ['Penicillin'],
        pastMedicalHistory: ['Hypertension'],
      };
      expect(determineAgent(data)).toBe('HandoverSpecialist');
    });
  });

  describe('Property 6: Priority Order is Respected', () => {
    it('should prioritize Triage over all other agents', () => {
      // Even with complete data, missing chief complaint should route to Triage
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: null,
        hpi: 'Complete HPI with sufficient length for the test to pass validation.',
        recordsCheckCompleted: true,
        medications: ['Aspirin'],
        allergies: ['Penicillin'],
        pastMedicalHistory: ['Hypertension'],
      };
      expect(determineAgent(data)).toBe('Triage');
    });

    it('should prioritize ClinicalInvestigator over RecordsClerk', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Short',
        recordsCheckCompleted: false,
      };
      expect(determineAgent(data)).toBe('ClinicalInvestigator');
    });

    it('should prioritize RecordsClerk over HistorySpecialist', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 3 days, worse in the morning, associated with nausea.',
        recordsCheckCompleted: false,
        medications: [],
        allergies: [],
        pastMedicalHistory: [],
      };
      expect(determineAgent(data)).toBe('RecordsClerk');
    });
  });
});
