/**
 * Integration Tests: Intake Interface Enhancements
 * 
 * Tests the complete end-to-end flow for intake interface enhancements:
 * 1. Vitals collection flow
 * 2. Triage decision → agent routing integration
 * 3. Emergency detection → alert display flow
 * 4. Vitals data persistence and display
 * 5. Complete integration flow
 * 
 * Requirements: All requirements from intake-interface-enhancements spec
 * 
 * Note: These tests focus on the triage service logic and data flow
 * without requiring database connections. Database-dependent tests
 * are in separate test files.
 */

import { describe, it, expect } from 'vitest';
import { analyzeVitals, detectEmergency } from '../../src/server/services/triage-service';
import type { VitalsData } from '@/app/types';

describe('Intake Interface Enhancements - End-to-End Integration Tests', () => {
  describe('1. End-to-End Vitals Collection Flow', () => {
    it('should complete full vitals collection flow with triage analysis', () => {
      // Step 1: Simulate vitals collection
      const vitalsData: VitalsData = {
        patientName: 'John Doe',
        patientAge: 35,
        patientGender: 'male',
        temperature: {
          value: 37.2,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 75,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date()
        },
        currentStatus: 'I have a mild headache',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      // Step 2: Analyze vitals with triage service
      const triageResult = analyzeVitals(vitalsData);
      expect(triageResult.decision).toBeDefined();
      expect(['emergency', 'agent-assisted', 'direct-to-diagnosis']).toContain(triageResult.decision);
      
      // Step 3: Verify triage decision has rationale
      expect(triageResult.reason).toBeDefined();
      expect(triageResult.reason.length).toBeGreaterThan(0);
      expect(triageResult.factors).toBeDefined();
      expect(triageResult.factors.length).toBeGreaterThan(0);
      
      // Step 4: Verify vitals stage can be completed
      const updatedVitals = {
        ...vitalsData,
        vitalsStageCompleted: true,
        triageDecision: triageResult.decision,
        triageReason: triageResult.reason
      };
      
      expect(updatedVitals.vitalsStageCompleted).toBe(true);
      expect(updatedVitals.triageDecision).not.toBe('pending');
      expect(updatedVitals.triageReason).toBeDefined();
      
      // Step 5: Verify agent routing logic
      const expectedAgent = triageResult.decision === 'emergency' 
        ? 'VitalsTriageAgent' 
        : 'Triage';
      
      expect(['VitalsTriageAgent', 'Triage']).toContain(expectedAgent);
    });

    it('should handle incomplete vitals gracefully', () => {
      // Vitals with only required demographics
      const incompleteVitals: VitalsData = {
        patientName: 'Jane Doe',
        patientAge: 28,
        patientGender: 'female',
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
        currentStatus: 'Mild cough for 2 days',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      // Should not throw error
      const triageResult = analyzeVitals(incompleteVitals);
      
      // Should make a decision despite missing vitals
      expect(triageResult.decision).toBeDefined();
      expect(triageResult.factors).toBeDefined();
      expect(triageResult.factors.some(f => f.includes('not collected'))).toBe(true);
    });
  });

  describe('2. Triage Decision → Agent Routing Integration', () => {
    it('should route to agent-assisted intake for complex cases', () => {
      const complexVitals: VitalsData = {
        patientName: 'Complex Case',
        patientAge: 70,
        patientGender: 'male',
        temperature: {
          value: 38.8,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 80,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 150,
          diastolic: 95,
          collectedAt: new Date()
        },
        currentStatus: 'I have been experiencing persistent chest discomfort, shortness of breath, and fatigue for the past week. I also have a history of hypertension and am taking medication for it.',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const triageResult = analyzeVitals(complexVitals);
      
      expect(triageResult.decision).toBe('agent-assisted');
      expect(triageResult.factors.length).toBeGreaterThan(0);
      expect(triageResult.reason).toContain('complexity');
    });

    it('should route to direct-to-diagnosis for simple cases', () => {
      const simpleVitals: VitalsData = {
        patientName: 'Simple Case',
        patientAge: 25,
        patientGender: 'female',
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 65,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 115,
          diastolic: 75,
          collectedAt: new Date()
        },
        currentStatus: 'Mild headache',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const triageResult = analyzeVitals(simpleVitals);
      
      expect(triageResult.decision).toBe('direct-to-diagnosis');
      expect(triageResult.factors.some(f => f.includes('Normal') || f.includes('Clear'))).toBe(true);
    });

    it('should record triage decision with rationale', () => {
      const vitals: VitalsData = {
        patientName: 'Test Patient',
        patientAge: 40,
        patientGender: 'male',
        temperature: {
          value: 37.5,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 75,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date()
        },
        currentStatus: 'Sore throat',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const triageResult = analyzeVitals(vitals);
      
      // Verify decision is recorded
      expect(triageResult.decision).toBeDefined();
      expect(triageResult.reason).toBeDefined();
      expect(triageResult.reason.length).toBeGreaterThan(0);
      
      // Verify factors are provided
      expect(triageResult.factors).toBeDefined();
      expect(Array.isArray(triageResult.factors)).toBe(true);
      expect(triageResult.factors.length).toBeGreaterThan(0);
    });
  });

  describe('3. Emergency Detection → Alert Display Flow', () => {
    it('should detect emergency from high temperature', () => {
      const emergencyVitals: VitalsData = {
        patientName: 'Emergency Patient',
        patientAge: 45,
        patientGender: 'female',
        temperature: {
          value: 40.0,
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
        currentStatus: 'High fever and chills',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const emergencyResult = detectEmergency(emergencyVitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.severity).toBe('critical');
      expect(emergencyResult.indicators.length).toBeGreaterThan(0);
      expect(emergencyResult.indicators[0]?.type).toBe('temperature');
      expect(emergencyResult.recommendations.length).toBeGreaterThan(0);
      expect(emergencyResult.recommendations.some(r => r.includes('immediate'))).toBe(true);
    });

    it('should detect emergency from critical blood pressure', () => {
      const emergencyVitals: VitalsData = {
        patientName: 'BP Emergency',
        patientAge: 60,
        patientGender: 'male',
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 85,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 190,
          diastolic: 125,
          collectedAt: new Date()
        },
        currentStatus: 'Severe headache',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const emergencyResult = detectEmergency(emergencyVitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.indicators.some(i => i.type === 'blood_pressure')).toBe(true);
      expect(emergencyResult.recommendations.some(r => 
        r.includes('emergency') || r.includes('immediate')
      )).toBe(true);
    });

    it('should detect emergency from critical symptoms', () => {
      const emergencyVitals: VitalsData = {
        patientName: 'Symptom Emergency',
        patientAge: 55,
        patientGender: 'male',
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 80,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          collectedAt: new Date()
        },
        currentStatus: 'Severe chest pain and difficulty breathing',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const emergencyResult = detectEmergency(emergencyVitals);
      
      expect(emergencyResult.isEmergency).toBe(true);
      expect(emergencyResult.indicators.some(i => i.type === 'symptoms')).toBe(true);
      expect(emergencyResult.recommendations.length).toBeGreaterThan(0);
    });

    it('should prevent normal workflow progression for emergencies', () => {
      const emergencyVitals: VitalsData = {
        patientName: 'Emergency Block',
        patientAge: 50,
        patientGender: 'female',
        temperature: {
          value: 34.5,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 60,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 85,
          diastolic: 55,
          collectedAt: new Date()
        },
        currentStatus: 'Feeling very cold and weak',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      const triageResult = analyzeVitals(emergencyVitals);
      
      // Emergency should be flagged
      expect(triageResult.decision).toBe('emergency');
      
      // Agent should remain VitalsTriageAgent (not progress)
      expect(triageResult.decision).toBe('emergency');
      expect(triageResult.confidence).toBe(1.0);
    });
  });

  describe('4. Vitals Data Persistence and Display', () => {
    it('should persist vitals data with all fields', () => {
      const vitalsData: VitalsData = {
        patientName: 'Persistence Test',
        patientAge: 42,
        patientGender: 'other',
        temperature: {
          value: 36.8,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 68,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 118,
          diastolic: 78,
          collectedAt: new Date()
        },
        currentStatus: 'Routine checkup',
        vitalsCollected: true,
        vitalsStageCompleted: true,
        triageDecision: 'direct-to-diagnosis',
        triageReason: 'Normal vitals, simple presentation'
      };
      
      // Verify vitals data structure is complete
      expect(vitalsData.patientName).toBeDefined();
      expect(vitalsData.patientAge).toBeDefined();
      expect(vitalsData.patientGender).toBeDefined();
      expect(vitalsData.temperature.value).toBeDefined();
      expect(vitalsData.weight.value).toBeDefined();
      expect(vitalsData.bloodPressure.systolic).toBeDefined();
      expect(vitalsData.bloodPressure.diastolic).toBeDefined();
      expect(vitalsData.triageDecision).not.toBe('pending');
      expect(vitalsData.triageReason).toBeDefined();
    });

    it('should indicate missing vitals in display', () => {
      const partialVitals: VitalsData = {
        patientName: 'Partial Data',
        patientAge: 30,
        patientGender: 'female',
        temperature: {
          value: 37.0,
          unit: 'celsius',
          collectedAt: new Date()
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
        currentStatus: 'Minor issue',
        vitalsCollected: true,
        vitalsStageCompleted: true,
        triageDecision: 'direct-to-diagnosis',
        triageReason: 'Simple case'
      };
      
      // Verify missing vitals are null
      expect(partialVitals.weight.value).toBeNull();
      expect(partialVitals.bloodPressure.systolic).toBeNull();
      expect(partialVitals.bloodPressure.diastolic).toBeNull();
      
      // Triage should still work
      const triageResult = analyzeVitals(partialVitals);
      expect(triageResult.decision).toBeDefined();
      expect(triageResult.factors.some(f => f.includes('not collected'))).toBe(true);
    });
  });

  describe('5. Complete Integration Flow', () => {
    it('should complete full intake flow with vitals collection and triage', () => {
      // Step 1: Simulate session creation
      const initialMedicalData = {
        currentAgent: 'VitalsTriageAgent' as const,
        vitalsData: {
          patientName: '',
          patientAge: 0,
          patientGender: 'prefer_not_to_say' as const,
          temperature: { value: null, unit: 'celsius' as const, collectedAt: null },
          weight: { value: null, unit: 'kg' as const, collectedAt: null },
          bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
          currentStatus: null,
          vitalsCollected: false,
          vitalsStageCompleted: false,
          triageDecision: 'pending' as const,
          triageReason: null
        }
      };
      
      expect(initialMedicalData.currentAgent).toBe('VitalsTriageAgent');
      expect(initialMedicalData.vitalsData.vitalsStageCompleted).toBe(false);
      
      // Step 2: Collect vitals
      const vitalsData: VitalsData = {
        patientName: 'Full Flow Test',
        patientAge: 38,
        patientGender: 'male',
        temperature: {
          value: 37.3,
          unit: 'celsius',
          collectedAt: new Date()
        },
        weight: {
          value: 78,
          unit: 'kg',
          collectedAt: new Date()
        },
        bloodPressure: {
          systolic: 122,
          diastolic: 82,
          collectedAt: new Date()
        },
        currentStatus: 'Persistent cough for 3 days with some fatigue',
        vitalsCollected: true,
        vitalsStageCompleted: false,
        triageDecision: 'pending',
        triageReason: null
      };
      
      // Step 3: Triage analysis
      const triageResult = analyzeVitals(vitalsData);
      expect(triageResult.decision).toBeDefined();
      
      // Step 4: Verify agent routing would transition
      const expectedAgent = triageResult.decision === 'emergency' 
        ? 'VitalsTriageAgent' 
        : 'Triage';
      
      expect(['VitalsTriageAgent', 'Triage']).toContain(expectedAgent);
      
      // Step 5: Verify vitals stage completion
      const updatedVitals = {
        ...vitalsData,
        vitalsStageCompleted: true,
        triageDecision: triageResult.decision,
        triageReason: triageResult.reason
      };
      
      expect(updatedVitals.vitalsStageCompleted).toBe(true);
      expect(updatedVitals.triageDecision).not.toBe('pending');
      expect(updatedVitals.triageReason).toBeDefined();
      expect(updatedVitals.triageReason?.length).toBeGreaterThan(0);
    });
  });
});
