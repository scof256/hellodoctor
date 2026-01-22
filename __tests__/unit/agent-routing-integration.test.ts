/**
 * Agent Routing Integration Tests
 * 
 * Tests for task 12: Verify Agent Routing Integration
 * Validates Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
 */

import { describe, it, expect } from 'vitest';
import { determineAgent, agentToStage, ROUTING_PRIORITY } from '../../app/lib/agent-router';
import type { MedicalData, AgentRole } from '../../app/types';

describe('Agent Routing Integration', () => {
  // Helper to create base medical data
  const createBaseMedicalData = (overrides?: Partial<MedicalData>): MedicalData => ({
    chiefComplaint: null,
    hpi: null,
    medications: [],
    allergies: [],
    pastMedicalHistory: [],
    familyHistory: [],
    socialHistory: [],
    recordsCheckCompleted: false,
    historyCheckCompleted: false,
    currentAgent: 'VitalsTriageAgent' as AgentRole,
    vitalsData: {
      patientName: null,
      patientAge: null,
      patientGender: null,
      temperature: { value: null, unit: 'celsius', collectedAt: null },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: null,
      vitalsCollected: false,
      vitalsStageCompleted: false,
      triageDecision: 'pending',
      triageReason: null,
    },
    clinicalHandover: null,
    ucgRecommendations: null,
    ...overrides,
  });

  describe('Requirement 9.2: VitalsTriageAgent Priority', () => {
    it('should route to VitalsTriageAgent when vitalsStageCompleted is false', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: null,
          patientAge: null,
          patientGender: null,
          temperature: { value: null, unit: 'celsius', collectedAt: null },
          weight: { value: null, unit: 'kg', collectedAt: null },
          bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
          currentStatus: null,
          vitalsCollected: false,
          vitalsStageCompleted: false,
          triageDecision: 'pending',
          triageReason: null,
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent');
    });

    it('should route to VitalsTriageAgent even when other data is present', () => {
      const medicalData = createBaseMedicalData({
        chiefComplaint: 'Headache',
        hpi: 'Patient has severe headache for 3 days with nausea and sensitivity to light',
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: false, // Still false
          triageDecision: 'pending',
          triageReason: null,
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent');
    });

    it('should route to VitalsTriageAgent when vitalsData is missing', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: undefined as any,
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent');
    });
  });

  describe('Requirement 9.3: Vitals Stage Completion Skip', () => {
    it('should NOT route to VitalsTriageAgent when vitalsStageCompleted is true', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true, // Completed
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals, proceeding to triage',
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).not.toBe('VitalsTriageAgent');
      expect(agent).toBe('Triage'); // Should move to next agent
    });

    it('should skip VitalsTriageAgent on subsequent messages after completion', () => {
      const medicalData = createBaseMedicalData({
        chiefComplaint: 'Headache',
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).not.toBe('VitalsTriageAgent');
      expect(agent).toBe('ClinicalInvestigator'); // Has chief complaint, needs HPI
    });
  });

  describe('Requirement 9.4: Agent Routing Priority Order', () => {
    it('should respect priority: VitalsTriageAgent (highest)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: null,
          patientAge: null,
          patientGender: null,
          temperature: { value: null, unit: 'celsius', collectedAt: null },
          weight: { value: null, unit: 'kg', collectedAt: null },
          bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
          currentStatus: null,
          vitalsCollected: false,
          vitalsStageCompleted: false,
          triageDecision: 'pending',
          triageReason: null,
        },
      });

      expect(determineAgent(medicalData)).toBe('VitalsTriageAgent');
    });

    it('should respect priority: Triage (after vitals)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        chiefComplaint: null, // No chief complaint yet
      });

      expect(determineAgent(medicalData)).toBe('Triage');
    });

    it('should respect priority: ClinicalInvestigator (after triage)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        chiefComplaint: 'Headache',
        hpi: null, // No HPI yet
      });

      expect(determineAgent(medicalData)).toBe('ClinicalInvestigator');
    });

    it('should respect priority: RecordsClerk (after investigation)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        chiefComplaint: 'Headache',
        hpi: 'Patient has severe headache for 3 days with nausea and sensitivity to light',
        recordsCheckCompleted: false,
      });

      expect(determineAgent(medicalData)).toBe('RecordsClerk');
    });

    it('should respect priority: HistorySpecialist (after records)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        chiefComplaint: 'Headache',
        hpi: 'Patient has severe headache for 3 days with nausea and sensitivity to light',
        recordsCheckCompleted: true,
        historyCheckCompleted: false,
        medications: [],
        allergies: [],
        pastMedicalHistory: [],
      });

      expect(determineAgent(medicalData)).toBe('HistorySpecialist');
    });

    it('should respect priority: HandoverSpecialist (lowest, all complete)', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        chiefComplaint: 'Headache',
        hpi: 'Patient has severe headache for 3 days with nausea and sensitivity to light',
        recordsCheckCompleted: true,
        historyCheckCompleted: true,
        medications: ['Ibuprofen'],
        allergies: ['Penicillin'],
        pastMedicalHistory: ['Hypertension'],
      });

      expect(determineAgent(medicalData)).toBe('HandoverSpecialist');
    });
  });

  describe('Requirement 9.1: Agent Transition After Vitals Completion', () => {
    it('should transition from VitalsTriageAgent to Triage after vitals completion', () => {
      const beforeCompletion = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: false,
          triageDecision: 'pending',
          triageReason: null,
        },
      });

      expect(determineAgent(beforeCompletion)).toBe('VitalsTriageAgent');

      const afterCompletion = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true, // Now completed
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
      });

      expect(determineAgent(afterCompletion)).toBe('Triage');
    });

    it('should use determineAgent function for next agent selection', () => {
      // This test verifies that the determineAgent function is the source of truth
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        },
        currentAgent: 'VitalsTriageAgent' as AgentRole, // Old agent
      });

      const nextAgent = determineAgent(medicalData);
      expect(nextAgent).toBe('Triage');
      expect(nextAgent).not.toBe(medicalData.currentAgent);
    });
  });

  describe('Requirement 9.6: CurrentAgent Field Update', () => {
    it('should map VitalsTriageAgent to vitals stage', () => {
      const stage = agentToStage('VitalsTriageAgent');
      expect(stage).toBe('vitals');
    });

    it('should map all agents to correct stages', () => {
      expect(agentToStage('VitalsTriageAgent')).toBe('vitals');
      expect(agentToStage('Triage')).toBe('triage');
      expect(agentToStage('ClinicalInvestigator')).toBe('investigation');
      expect(agentToStage('RecordsClerk')).toBe('records');
      expect(agentToStage('HistorySpecialist')).toBe('profile');
      expect(agentToStage('HandoverSpecialist')).toBe('summary');
    });
  });

  describe('ROUTING_PRIORITY Export', () => {
    it('should export ROUTING_PRIORITY with correct priority functions', () => {
      expect(ROUTING_PRIORITY).toBeDefined();
      expect(ROUTING_PRIORITY.VitalsTriageAgent).toBeTypeOf('function');
      expect(ROUTING_PRIORITY.Triage).toBeTypeOf('function');
      expect(ROUTING_PRIORITY.ClinicalInvestigator).toBeTypeOf('function');
      expect(ROUTING_PRIORITY.RecordsClerk).toBeTypeOf('function');
      expect(ROUTING_PRIORITY.HistorySpecialist).toBeTypeOf('function');
      expect(ROUTING_PRIORITY.HandoverSpecialist).toBeTypeOf('function');
    });

    it('should have VitalsTriageAgent priority function check vitalsStageCompleted', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: null,
          patientAge: null,
          patientGender: null,
          temperature: { value: null, unit: 'celsius', collectedAt: null },
          weight: { value: null, unit: 'kg', collectedAt: null },
          bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
          currentStatus: null,
          vitalsCollected: false,
          vitalsStageCompleted: false,
          triageDecision: 'pending',
          triageReason: null,
        },
      });

      expect(ROUTING_PRIORITY.VitalsTriageAgent(medicalData)).toBe(true);

      medicalData.vitalsData!.vitalsStageCompleted = true;
      expect(ROUTING_PRIORITY.VitalsTriageAgent(medicalData)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null vitalsData gracefully', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: null as any,
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent');
    });

    it('should handle undefined vitalsData gracefully', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: undefined as any,
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent');
    });

    it('should handle vitalsData without vitalsStageCompleted field', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Feeling unwell',
          vitalsCollected: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Normal vitals',
        } as any, // Missing vitalsStageCompleted
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('VitalsTriageAgent'); // Should default to VitalsTriageAgent
    });
  });

  describe('Integration with Triage Decisions', () => {
    it('should work with emergency triage decision', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 40.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 190, diastolic: 130, collectedAt: new Date() },
          currentStatus: 'Severe chest pain',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'emergency',
          triageReason: 'Critical vital signs detected',
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('Triage'); // Should still follow normal routing
    });

    it('should work with direct-to-diagnosis triage decision', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 37.0, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 120, diastolic: 80, collectedAt: new Date() },
          currentStatus: 'Minor headache',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'direct-to-diagnosis',
          triageReason: 'Simple case with normal vitals',
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('Triage'); // Should still follow normal routing
    });

    it('should work with agent-assisted triage decision', () => {
      const medicalData = createBaseMedicalData({
        vitalsData: {
          patientName: 'John Doe',
          patientAge: 35,
          patientGender: 'male',
          temperature: { value: 38.5, unit: 'celsius', collectedAt: new Date() },
          weight: { value: 75, unit: 'kg', collectedAt: new Date() },
          bloodPressure: { systolic: 140, diastolic: 90, collectedAt: new Date() },
          currentStatus: 'Multiple symptoms',
          vitalsCollected: true,
          vitalsStageCompleted: true,
          triageDecision: 'agent-assisted',
          triageReason: 'Complex case requiring detailed investigation',
        },
      });

      const agent = determineAgent(medicalData);
      expect(agent).toBe('Triage'); // Should still follow normal routing
    });
  });
});
