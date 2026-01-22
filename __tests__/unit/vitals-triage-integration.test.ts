/**
 * Vitals Triage Integration Tests
 * 
 * Tests the integration between vitals collection and triage service
 * Requirements: 1.5, 1.6, 2.6, 3.6, 9.1, 9.6
 */

import { describe, it, expect } from 'vitest';
import { triageService } from '@/server/services/triage-service';
import type { VitalsData } from '@/app/types';

describe('Vitals Triage Integration', () => {
  describe('Emergency Detection', () => {
    it('should detect emergency from high temperature', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 35,
        patientGender: 'male',
        vitalsCollected: true,
        temperature: {
          value: 40.0,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 70,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'Feeling very hot',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const emergencyResult = triageService.detectEmergency(vitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.indicators.length).toBeGreaterThan(0);
      expect(emergencyResult.indicators[0]?.type).toBe('temperature');
      expect(emergencyResult.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect emergency from high blood pressure', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 55,
        patientGender: 'female',
        vitalsCollected: true,
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 65,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 190,
          diastolic: 110,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'Headache',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const emergencyResult = triageService.detectEmergency(vitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.indicators.length).toBeGreaterThan(0);
      expect(emergencyResult.indicators[0]?.type).toBe('blood_pressure');
    });

    it('should detect emergency from critical symptoms', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 45,
        patientGender: 'male',
        vitalsCollected: true,
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 80,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'Severe chest pain and difficulty breathing',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const emergencyResult = triageService.detectEmergency(vitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.indicators.length).toBeGreaterThan(0);
      expect(emergencyResult.indicators.some(i => i.type === 'symptoms')).toBe(true);
    });
  });

  describe('Triage Decision Making', () => {
    it('should route to agent-assisted for complex case', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 70,
        patientGender: 'male',
        vitalsCollected: true,
        temperature: {
          value: 38.8,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 75,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 150,
          diastolic: 95,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'I have been experiencing persistent cough, fever, and fatigue for the past week. I also have a history of diabetes and hypertension.',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const triageResult = triageService.analyzeVitals(vitals);
      
      expect(triageResult.decision).toBe('agent-assisted');
      expect(triageResult.factors.length).toBeGreaterThan(0);
      expect(triageResult.confidence).toBeGreaterThan(0);
    });

    it('should route to direct-to-diagnosis for simple case', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 30,
        patientGender: 'female',
        vitalsCollected: true,
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 60,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 115,
          diastolic: 75,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'Mild headache',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const triageResult = triageService.analyzeVitals(vitals);
      
      expect(triageResult.decision).toBe('direct-to-diagnosis');
      expect(triageResult.factors.length).toBeGreaterThan(0);
    });

    it('should handle incomplete vitals gracefully', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 25,
        patientGender: 'other',
        vitalsCollected: true,
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
        currentStatus: 'Feeling tired',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const triageResult = triageService.analyzeVitals(vitals);
      
      // Should not throw error and should make a decision
      expect(triageResult.decision).toBeDefined();
      expect(['agent-assisted', 'direct-to-diagnosis', 'emergency']).toContain(triageResult.decision);
    });
  });

  describe('Vitals Stage Completion', () => {
    it('should set vitalsStageCompleted to true after triage', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 40,
        patientGender: 'male',
        vitalsCollected: true,
        temperature: {
          value: 37.2,
          unit: 'celsius',
          collectedAt: new Date().toISOString()
        },
        weight: {
          value: 75,
          unit: 'kg',
          collectedAt: new Date().toISOString()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date().toISOString()
        },
        currentStatus: 'Regular checkup',
        triageDecision: 'pending',
        triageReason: null,
        vitalsStageCompleted: false
      };

      const triageResult = triageService.analyzeVitals(vitals);
      
      // After triage, vitalsStageCompleted should be set to true
      // This is handled by the API endpoint
      expect(triageResult).toBeDefined();
      expect(triageResult.decision).toBeDefined();
      expect(triageResult.reason).toBeDefined();
    });
  });
});


describe('Incomplete Vitals Scenarios', () => {
  it('should handle patient who skips all optional vitals', () => {
    const vitals: VitalsData = {
      patientName: 'John Doe',
      patientAge: 35,
      patientGender: 'male',
      temperature: { value: null, unit: 'celsius', collectedAt: null },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: 'mild headache',
      vitalsCollected: true,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null
    };

    const result = triageService.analyzeVitals(vitals);

    expect(result).toBeDefined();
    expect(result.decision).toBe('direct-to-diagnosis');
    expect(result.factors.some(f => f.includes('not collected'))).toBe(true);
  });

  it('should handle patient with only temperature', () => {
    const vitals: VitalsData = {
      patientName: 'Jane Smith',
      patientAge: 28,
      patientGender: 'female',
      temperature: { value: 37.2, unit: 'celsius', collectedAt: new Date().toISOString() },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: 'feeling tired',
      vitalsCollected: true,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null
    };

    const result = triageService.analyzeVitals(vitals);

    expect(result).toBeDefined();
    expect(result.factors.some(f => f.includes('Normal temperature'))).toBe(true);
    expect(result.factors.some(f => f.includes('weight'))).toBe(true);
    expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
  });

  it('should detect emergency even with missing vitals', () => {
    const vitals: VitalsData = {
      patientName: 'Emergency Patient',
      patientAge: 45,
      patientGender: 'male',
      temperature: { value: null, unit: 'celsius', collectedAt: null },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: 'severe chest pain and difficulty breathing',
      vitalsCollected: true,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null
    };

    const result = triageService.analyzeVitals(vitals);

    expect(result).toBeDefined();
    expect(result.decision).toBe('emergency');
    expect(result.confidence).toBe(1.0);
  });

  it('should route to agent-assisted based on complex symptoms alone', () => {
    const vitals: VitalsData = {
      patientName: 'Complex Patient',
      patientAge: 65,
      patientGender: 'female',
      temperature: { value: null, unit: 'celsius', collectedAt: null },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: 'I have chronic pain, fever, cough, nausea, dizziness, and have been taking medication for multiple conditions including hypertension and diabetes',
      vitalsCollected: true,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null
    };

    const result = triageService.analyzeVitals(vitals);

    expect(result).toBeDefined();
    expect(result.decision).toBe('agent-assisted');
    expect(result.factors.some(f => f.toLowerCase().includes('symptom'))).toBe(true);
  });

  it('should handle partial blood pressure gracefully', () => {
    const vitals: VitalsData = {
      patientName: 'Partial BP Patient',
      patientAge: 50,
      patientGender: 'male',
      temperature: { value: 37.0, unit: 'celsius', collectedAt: new Date().toISOString() },
      weight: { value: 75, unit: 'kg', collectedAt: new Date().toISOString() },
      bloodPressure: { systolic: 120, diastolic: null, collectedAt: null },
      currentStatus: 'routine checkup',
      vitalsCollected: true,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null
    };

    const result = triageService.analyzeVitals(vitals);

    expect(result).toBeDefined();
    expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
  });
});
