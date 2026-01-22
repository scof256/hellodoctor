/**
 * Unit tests for Triage Service
 * Tests the complexity evaluation logic
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateComplexity,
  analyzeVitals,
  type VitalsData
} from '../../src/server/services/triage-service';

describe('Triage Service - Complexity Evaluation', () => {
  // Helper to create base vitals data
  const createBaseVitals = (): VitalsData => ({
    patientName: 'Test Patient',
    patientAge: 35,
    patientGender: 'male',
    temperature: {
      value: 37.0,
      unit: 'celsius',
      collectedAt: new Date()
    },
    weight: {
      value: 70,
      unit: 'kg',
      collectedAt: new Date()
    },
    bloodPressure: {
      systolic: 120,
      diastolic: 80,
      collectedAt: new Date()
    },
    currentStatus: 'mild headache',
    vitalsCollected: true,
    vitalsStageCompleted: false,
    triageDecision: 'pending',
    triageReason: null
  });

  describe('evaluateComplexity', () => {
    it('should identify simple case with short symptom description', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'headache';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(false);
      expect(result.needsAgentAssistance).toBe(false);
    });

    it('should identify complex case with long symptom description', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'I have been experiencing severe headaches for the past week, along with nausea, dizziness, and fatigue. The pain is worse in the morning and sometimes I feel like vomiting. I also have some neck stiffness and sensitivity to light.';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should identify complex case with multiple symptoms', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'headache, fever, cough, and fatigue';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.some(f => f.includes('symptom'))).toBe(true);
    });

    it('should identify complex case with concerning temperature', () => {
      const vitals = createBaseVitals();
      vitals.temperature.value = 39.0; // High fever, approaching emergency
      vitals.currentStatus = 'high fever, headache, and body pain';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.some(f => f.includes('temperature'))).toBe(true);
    });

    it('should identify complex case with concerning blood pressure', () => {
      const vitals = createBaseVitals();
      vitals.bloodPressure.systolic = 160; // Elevated
      vitals.bloodPressure.diastolic = 95; // Elevated
      vitals.currentStatus = 'feeling unwell';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
    });

    it('should identify complex case with chronic condition mention', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'chronic back pain that has been getting worse, along with numbness';

      const result = evaluateComplexity(vitals);

      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.some(f => f.toLowerCase().includes('chronic'))).toBe(true);
    });

    it('should consider age factors for young children', () => {
      const vitals = createBaseVitals();
      vitals.patientAge = 3;
      vitals.currentStatus = 'fever and cough';

      const result = evaluateComplexity(vitals);

      expect(result.factors.some(f => f.includes('Young child'))).toBe(true);
    });

    it('should consider age factors for elderly patients', () => {
      const vitals = createBaseVitals();
      vitals.patientAge = 75;
      vitals.currentStatus = 'feeling weak';

      const result = evaluateComplexity(vitals);

      expect(result.factors.some(f => f.includes('Elderly'))).toBe(true);
    });
  });

  describe('analyzeVitals', () => {
    it('should route simple case to direct-to-diagnosis', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'mild headache';

      const result = analyzeVitals(vitals);

      expect(result.decision).toBe('direct-to-diagnosis');
      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.reason).toContain('Straightforward');
    });

    it('should route complex case to agent-assisted', () => {
      const vitals = createBaseVitals();
      vitals.currentStatus = 'I have chronic pain, fever, cough, nausea, and have been taking medication for hypertension';

      const result = analyzeVitals(vitals);

      expect(result.decision).toBe('agent-assisted');
      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.reason).toContain('complexity');
    });

    it('should provide specific factors in decision rationale', () => {
      const vitals = createBaseVitals();
      vitals.temperature.value = 38.8;
      vitals.currentStatus = 'fever, headache, and body aches';

      const result = analyzeVitals(vitals);

      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.reason).toBeTruthy();
    });

    it('should detect emergency and override complexity evaluation', () => {
      const vitals = createBaseVitals();
      vitals.temperature.value = 40.0; // Emergency level
      vitals.currentStatus = 'very high fever';

      const result = analyzeVitals(vitals);

      expect(result.decision).toBe('emergency');
      expect(result.confidence).toBe(1.0);
    });
  });
});

describe('Triage Service - Incomplete Vitals Handling', () => {
  // Helper to create vitals with all fields null
  const createEmptyVitals = (): VitalsData => ({
    patientName: 'Test Patient',
    patientAge: 35,
    patientGender: 'male',
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
    vitalsCollected: true,
    vitalsStageCompleted: false,
    triageDecision: 'pending',
    triageReason: null
  });

  describe('evaluateComplexity with missing vitals', () => {
    it('should handle all vitals missing gracefully', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'mild headache';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.isComplex).toBe(false);
      expect(result.needsAgentAssistance).toBe(false);
      expect(result.factors.some(f => f.includes('not collected'))).toBe(true);
    });

    it('should handle missing temperature only', () => {
      const vitals = createEmptyVitals();
      vitals.bloodPressure.systolic = 120;
      vitals.bloodPressure.diastolic = 80;
      vitals.weight.value = 70;
      vitals.currentStatus = 'feeling fine';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.factors.some(f => f.includes('temperature'))).toBe(true);
    });

    it('should handle missing blood pressure only', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 37.0;
      vitals.weight.value = 70;
      vitals.currentStatus = 'feeling fine';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
    });

    it('should handle missing weight only', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 37.0;
      vitals.bloodPressure.systolic = 120;
      vitals.bloodPressure.diastolic = 80;
      vitals.currentStatus = 'feeling fine';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.factors.some(f => f.includes('weight'))).toBe(true);
    });

    it('should handle partial blood pressure (systolic only)', () => {
      const vitals = createEmptyVitals();
      vitals.bloodPressure.systolic = 120;
      vitals.bloodPressure.diastolic = null;
      vitals.currentStatus = 'feeling fine';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      // Should still note blood pressure as not fully collected
      expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
    });

    it('should handle partial blood pressure (diastolic only)', () => {
      const vitals = createEmptyVitals();
      vitals.bloodPressure.systolic = null;
      vitals.bloodPressure.diastolic = 80;
      vitals.currentStatus = 'feeling fine';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      // Should still note blood pressure as not fully collected
      expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
    });

    it('should handle missing current status', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 37.0;
      vitals.bloodPressure.systolic = 120;
      vitals.bloodPressure.diastolic = 80;
      vitals.currentStatus = null;

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.isComplex).toBe(false);
    });

    it('should make decision with only demographics and symptoms', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'I have chronic pain, fever, cough, nausea, and have been taking medication';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.isComplex).toBe(true);
      expect(result.needsAgentAssistance).toBe(true);
      expect(result.factors.some(f => f.includes('symptom'))).toBe(true);
    });

    it('should handle combination of missing vitals', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 37.0;
      // Weight and BP missing
      vitals.currentStatus = 'mild headache';

      const result = evaluateComplexity(vitals);

      expect(result).toBeDefined();
      expect(result.factors.some(f => f.includes('weight'))).toBe(true);
      expect(result.factors.some(f => f.includes('blood pressure'))).toBe(true);
    });
  });

  describe('analyzeVitals with missing vitals', () => {
    it('should make triage decision with all vitals missing', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'mild headache';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('direct-to-diagnosis');
      expect(result.factors.some(f => f.includes('not collected'))).toBe(true);
    });

    it('should route to agent-assisted based on symptoms alone when vitals missing', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'I have chronic pain, fever, cough, nausea, dizziness, and have been taking medication for multiple conditions';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('agent-assisted');
      expect(result.reason).toContain('complexity');
    });

    it('should include missing vitals note in factors', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'feeling unwell';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.factors.some(f => 
        f.includes('temperature') || 
        f.includes('weight') || 
        f.includes('blood pressure')
      )).toBe(true);
    });

    it('should handle only temperature available', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 37.0;
      vitals.currentStatus = 'feeling fine';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('direct-to-diagnosis');
      expect(result.factors.some(f => f.includes('Normal temperature'))).toBe(true);
    });

    it('should handle only blood pressure available', () => {
      const vitals = createEmptyVitals();
      vitals.bloodPressure.systolic = 120;
      vitals.bloodPressure.diastolic = 80;
      vitals.currentStatus = 'feeling fine';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('direct-to-diagnosis');
      expect(result.factors.some(f => f.includes('Normal blood pressure'))).toBe(true);
    });

    it('should not fail with completely empty vitals and no symptoms', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = null;

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('direct-to-diagnosis');
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should detect emergency even with some vitals missing', () => {
      const vitals = createEmptyVitals();
      vitals.temperature.value = 40.5; // Emergency level
      // Other vitals missing
      vitals.currentStatus = 'very high fever';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('emergency');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect emergency from blood pressure alone', () => {
      const vitals = createEmptyVitals();
      vitals.bloodPressure.systolic = 190; // Emergency level
      vitals.bloodPressure.diastolic = 125; // Emergency level
      // Other vitals missing
      vitals.currentStatus = 'feeling dizzy';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('emergency');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect emergency from symptoms alone when all vitals missing', () => {
      const vitals = createEmptyVitals();
      vitals.currentStatus = 'severe chest pain and difficulty breathing';

      const result = analyzeVitals(vitals);

      expect(result).toBeDefined();
      expect(result.decision).toBe('emergency');
      expect(result.confidence).toBe(1.0);
    });
  });
});
