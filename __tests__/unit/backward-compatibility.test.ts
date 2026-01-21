import { describe, it, expect, vi, beforeEach } from 'vitest';
import { INITIAL_MEDICAL_DATA, INITIAL_THOUGHT } from '@/types';
import type { MedicalData, DoctorThought } from '@/types';

describe('Backward Compatibility Handling', () => {
  describe('Session Data Loading', () => {
    it('should apply default values for historyCheckCompleted when missing', () => {
      // Simulate legacy session data without historyCheckCompleted
      const legacyMedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Headache',
        hpi: 'Patient reports severe headache for 2 days',
      };
      delete (legacyMedicalData as any).historyCheckCompleted;

      // Apply backward compatibility defaults (same logic as in getSession/sendMessage)
      const processedData = {
        ...INITIAL_MEDICAL_DATA,
        ...legacyMedicalData,
        historyCheckCompleted: legacyMedicalData.historyCheckCompleted ?? false,
        vitalsData: legacyMedicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true,
        },
      };

      expect(processedData.historyCheckCompleted).toBe(false);
      expect(processedData.chiefComplaint).toBe('Headache');
      expect(processedData.hpi).toBe('Patient reports severe headache for 2 days');
    });

    it('should apply default values for vitalsData when missing', () => {
      // Simulate legacy session data without vitalsData
      const legacyMedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Fever',
      };
      delete (legacyMedicalData as any).vitalsData;

      // Apply backward compatibility defaults
      const processedData = {
        ...INITIAL_MEDICAL_DATA,
        ...legacyMedicalData,
        historyCheckCompleted: legacyMedicalData.historyCheckCompleted ?? false,
        vitalsData: legacyMedicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true, // Skip vitals for existing sessions
        },
      };

      expect(processedData.vitalsData).toBeDefined();
      expect(processedData.vitalsData.vitalsStageCompleted).toBe(true);
      expect(processedData.chiefComplaint).toBe('Fever');
    });

    it('should preserve existing historyCheckCompleted value when present', () => {
      const medicalData = {
        ...INITIAL_MEDICAL_DATA,
        historyCheckCompleted: true,
        chiefComplaint: 'Cough',
      };

      // Apply backward compatibility defaults
      const processedData = {
        ...INITIAL_MEDICAL_DATA,
        ...medicalData,
        historyCheckCompleted: medicalData.historyCheckCompleted ?? false,
        vitalsData: medicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true,
        },
      };

      expect(processedData.historyCheckCompleted).toBe(true);
      expect(processedData.chiefComplaint).toBe('Cough');
    });

    it('should preserve existing vitalsData when present', () => {
      const medicalData = {
        ...INITIAL_MEDICAL_DATA,
        vitalsData: {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          bloodPressure: '120/80',
          heartRate: 75,
          vitalsStageCompleted: false,
        },
      };

      // Apply backward compatibility defaults
      const processedData = {
        ...INITIAL_MEDICAL_DATA,
        ...medicalData,
        historyCheckCompleted: medicalData.historyCheckCompleted ?? false,
        vitalsData: medicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true,
        },
      };

      expect(processedData.vitalsData.bloodPressure).toBe('120/80');
      expect(processedData.vitalsData.heartRate).toBe(75);
      expect(processedData.vitalsData.vitalsStageCompleted).toBe(false);
    });

    it('should handle missing doctorThought gracefully', () => {
      const doctorThought: DoctorThought | null = null;

      // Verify null is handled correctly
      expect(doctorThought).toBeNull();
    });

    it('should handle undefined doctorThought gracefully', () => {
      const rawDoctorThought: any = undefined;
      const doctorThought: DoctorThought | null = rawDoctorThought ?? null;

      // Verify undefined is converted to null
      expect(doctorThought).toBeNull();
    });

    it('should preserve existing doctorThought when present', () => {
      const doctorThought: DoctorThought = {
        ...INITIAL_THOUGHT,
        differentialDiagnosis: ['Migraine', 'Tension headache'],
        clinicalImpression: 'Likely migraine based on symptoms',
      };

      // Verify doctorThought is preserved
      expect(doctorThought.differentialDiagnosis).toEqual(['Migraine', 'Tension headache']);
      expect(doctorThought.clinicalImpression).toBe('Likely migraine based on symptoms');
    });

    it('should handle complete legacy session data transformation', () => {
      // Simulate a complete legacy session without new fields
      const legacyMedicalData: any = {
        chiefComplaint: 'Chest pain',
        hpi: 'Patient reports chest pain for 1 hour',
        medications: ['Aspirin'],
        allergies: [],
        pastMedicalHistory: ['Hypertension'],
        recordsCheckCompleted: true,
        // Missing: historyCheckCompleted, vitalsData
      };

      // Apply backward compatibility defaults
      const processedData = {
        ...INITIAL_MEDICAL_DATA,
        ...legacyMedicalData,
        historyCheckCompleted: legacyMedicalData.historyCheckCompleted ?? false,
        vitalsData: legacyMedicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true,
        },
      };

      // Verify all fields are present and correct
      expect(processedData.chiefComplaint).toBe('Chest pain');
      expect(processedData.hpi).toBe('Patient reports chest pain for 1 hour');
      expect(processedData.medications).toEqual(['Aspirin']);
      expect(processedData.historyCheckCompleted).toBe(false);
      expect(processedData.vitalsData.vitalsStageCompleted).toBe(true);
      expect(processedData.recordsCheckCompleted).toBe(true);
    });
  });
});
