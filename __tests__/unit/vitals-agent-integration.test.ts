import { describe, it, expect } from 'vitest';
import { determineAgent } from '../../app/lib/agent-router';
import type { MedicalData } from '../../app/types';

describe('VitalsTriageAgent Integration', () => {
  it('should select VitalsTriageAgent when vitalsStageCompleted is false', () => {
    const medicalData: MedicalData = {
      vitalsData: {
        patientName: null,
        patientAge: null,
        patientGender: null,
        vitalsCollected: false,
        temperature: { value: null, unit: 'celsius' },
        weight: { value: null, unit: 'kg' },
        bloodPressure: { systolic: null, diastolic: null },
        currentStatus: null,
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      },
      chiefComplaint: '',
      hpi: '',
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: '',
      socialHistory: '',
      clinicalHandover: {
        situation: '',
        background: '',
        assessment: '',
        recommendation: ''
      },
      ucgRecommendations: '',
      bookingStatus: 'collecting',
      currentAgent: 'VitalsTriageAgent',
      historyCheckCompleted: false
    };

    const agent = determineAgent(medicalData);
    expect(agent).toBe('VitalsTriageAgent');
  });

  it('should NOT select VitalsTriageAgent when vitalsStageCompleted is true', () => {
    const medicalData: MedicalData = {
      vitalsData: {
        patientName: 'John Doe',
        patientAge: 35,
        patientGender: 'male',
        vitalsCollected: true,
        temperature: { value: 37.5, unit: 'celsius' },
        weight: { value: 70, unit: 'kg' },
        bloodPressure: { systolic: 120, diastolic: 80 },
        currentStatus: 'I have a headache',
        triageDecision: 'normal',
        triageReason: null,
        vitalsStageCompleted: true
      },
      chiefComplaint: '',
      hpi: '',
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: '',
      socialHistory: '',
      clinicalHandover: {
        situation: '',
        background: '',
        assessment: '',
        recommendation: ''
      },
      ucgRecommendations: '',
      bookingStatus: 'collecting',
      currentAgent: 'Triage',
      historyCheckCompleted: false
    };

    const agent = determineAgent(medicalData);
    expect(agent).not.toBe('VitalsTriageAgent');
    expect(agent).toBe('Triage'); // Should move to Triage for chief complaint
  });

  it('should transition from VitalsTriageAgent to Triage after completion', () => {
    // Start with incomplete vitals
    const initialData: MedicalData = {
      vitalsData: {
        patientName: null,
        patientAge: null,
        patientGender: null,
        vitalsCollected: false,
        temperature: { value: null, unit: 'celsius' },
        weight: { value: null, unit: 'kg' },
        bloodPressure: { systolic: null, diastolic: null },
        currentStatus: null,
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      },
      chiefComplaint: '',
      hpi: '',
      medicalRecords: [],
      recordsCheckCompleted: false,
      medications: [],
      allergies: [],
      pastMedicalHistory: [],
      familyHistory: '',
      socialHistory: '',
      clinicalHandover: {
        situation: '',
        background: '',
        assessment: '',
        recommendation: ''
      },
      ucgRecommendations: '',
      bookingStatus: 'collecting',
      currentAgent: 'VitalsTriageAgent',
      historyCheckCompleted: false
    };

    expect(determineAgent(initialData)).toBe('VitalsTriageAgent');

    // Complete vitals stage
    const completedData: MedicalData = {
      ...initialData,
      vitalsData: {
        ...initialData.vitalsData,
        patientName: 'John Doe',
        patientAge: 35,
        patientGender: 'male',
        currentStatus: 'I have a headache',
        vitalsStageCompleted: true
      }
    };

    expect(determineAgent(completedData)).toBe('Triage');
  });
});
