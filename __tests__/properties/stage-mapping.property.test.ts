import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { agentToStage, determineAgent, calculateCompleteness } from '../../app/lib/agent-router';
import { MedicalData, INITIAL_MEDICAL_DATA, AgentRole, IntakeStage, VALID_AGENT_ROLES } from '../../app/types';

// Arbitraries for property testing
const arbitraryAgentRole = fc.constantFrom(...VALID_AGENT_ROLES);

const arbitraryMedicalData = fc.record({
  chiefComplaint: fc.option(fc.string(), { nil: null }),
  hpi: fc.option(fc.string(), { nil: null }),
  medicalRecords: fc.array(fc.string()),
  recordsCheckCompleted: fc.boolean(),
  medications: fc.array(fc.string()),
  allergies: fc.array(fc.string()),
  pastMedicalHistory: fc.array(fc.string()),
  familyHistory: fc.option(fc.string(), { nil: null }),
  socialHistory: fc.option(fc.string(), { nil: null }),
  reviewOfSystems: fc.array(fc.string()),
  currentAgent: arbitraryAgentRole,
  clinicalHandover: fc.constant(null),
  ucgRecommendations: fc.option(fc.string(), { nil: null }),
  bookingStatus: fc.constantFrom('collecting', 'ready', 'booked'),
  appointmentDate: fc.option(fc.string(), { nil: undefined })
}) as fc.Arbitrary<MedicalData>;

describe('Stage Mapping Properties', () => {
  describe('Property 3: Agent-to-Stage Mapping Consistency', () => {
    it('should have a valid stage mapping for every agent role', () => {
      fc.assert(fc.property(
        arbitraryAgentRole,
        (agent) => {
          const stage = agentToStage(agent);
          
          // Every agent should map to a valid stage
          expect(stage).toBeDefined();
          expect(typeof stage).toBe('string');
          
          // Check specific mappings
          const expectedMappings: Record<AgentRole, IntakeStage> = {
            'Triage': 'triage',
            'ClinicalInvestigator': 'investigation',
            'RecordsClerk': 'records',
            'HistorySpecialist': 'profile',
            'HandoverSpecialist': 'summary'
          };
          
          expect(stage).toBe(expectedMappings[agent]);
        }
      ));
    });

    it('should maintain consistent agent-stage progression', () => {
      // Test the progression: Triage -> Investigation -> Records -> Profile -> Summary
      const progressionStages: IntakeStage[] = ['triage', 'investigation', 'records', 'profile', 'summary'];
      const progressionAgents: AgentRole[] = ['Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist'];
      
      for (let i = 0; i < progressionAgents.length; i++) {
        const agent = progressionAgents[i];
        const expectedStage = progressionStages[i];
        const actualStage = agentToStage(agent);
        
        expect(actualStage).toBe(expectedStage);
      }
    });

    it('should determine agent correctly based on medical data state', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (data) => {
          const determinedAgent = determineAgent(data);
          const correspondingStage = agentToStage(determinedAgent);

          const hasChiefComplaint = typeof data.chiefComplaint === 'string' && data.chiefComplaint.trim().length > 0;
          const hasHpi = typeof data.hpi === 'string' && data.hpi.trim().length > 0;
          
          // Agent determination should be consistent with data state
          if (!hasChiefComplaint) {
            expect(determinedAgent).toBe('Triage');
            expect(correspondingStage).toBe('triage');
          } else if (!hasHpi || (data.hpi?.trim().length ?? 0) < 50) {
            expect(determinedAgent).toBe('ClinicalInvestigator');
            expect(correspondingStage).toBe('investigation');
          } else if (!data.recordsCheckCompleted) {
            expect(determinedAgent).toBe('RecordsClerk');
            expect(correspondingStage).toBe('records');
          }
          // Additional conditions tested in agent routing tests
        }
      ));
    });

    it('should calculate completeness consistently with agent progression', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (data) => {
          const completeness = calculateCompleteness(data);
          const agent = determineAgent(data);
          const stage = agentToStage(agent);
          
          // Completeness should be a valid percentage
          expect(completeness).toBeGreaterThanOrEqual(0);
          expect(completeness).toBeLessThanOrEqual(100);
          expect(Number.isInteger(completeness)).toBe(true);
          
          // Early stages should generally have lower completeness than later stages
          // But this is not a strict rule since fields can be filled in any order
          if (agent === 'HandoverSpecialist') {
            // Handover stage should have higher completeness since all required data is present
            expect(completeness).toBeGreaterThan(50);
          }
          
          // Completeness should reflect the actual data state
          if (!data.chiefComplaint && !data.hpi && 
              data.medications.length === 0 && data.allergies.length === 0 && 
              data.pastMedicalHistory.length === 0 && !data.familyHistory && 
              !data.socialHistory && !data.recordsCheckCompleted) {
            // If truly no data is present, completeness should be 0
            expect(completeness).toBe(0);
          }
        }
      ));
    });

    it('should maintain stage consistency during data progression', () => {
      // Test a realistic progression scenario
      let currentData: MedicalData = { ...INITIAL_MEDICAL_DATA };
      
      // Step 1: Add chief complaint -> should move to Investigation
      currentData = { ...currentData, chiefComplaint: 'Headache' };
      let agent = determineAgent(currentData);
      let stage = agentToStage(agent);
      expect(agent).toBe('ClinicalInvestigator');
      expect(stage).toBe('investigation');
      
      // Step 2: Add detailed HPI -> should move to Records
      currentData = { ...currentData, hpi: 'Patient reports severe headache that started 3 days ago, throbbing in nature, worse in the morning' };
      agent = determineAgent(currentData);
      stage = agentToStage(agent);
      expect(agent).toBe('RecordsClerk');
      expect(stage).toBe('records');
      
      // Step 3: Complete records check -> should move to History
      currentData = { ...currentData, recordsCheckCompleted: true };
      agent = determineAgent(currentData);
      stage = agentToStage(agent);
      expect(agent).toBe('HistorySpecialist');
      expect(stage).toBe('profile');
      
      // Step 4: Add history data -> should move to Handover
      currentData = { 
        ...currentData, 
        medications: ['Ibuprofen'],
        allergies: ['None'],
        pastMedicalHistory: ['Hypertension']
      };
      agent = determineAgent(currentData);
      stage = agentToStage(agent);
      expect(agent).toBe('HandoverSpecialist');
      expect(stage).toBe('summary');
    });

    it('should handle edge cases in stage mapping', () => {
      // Test with minimal data
      const minimalData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: null,
        hpi: null
      };
      
      const agent = determineAgent(minimalData);
      const stage = agentToStage(agent);
      
      expect(agent).toBe('Triage');
      expect(stage).toBe('triage');
      
      // Test with complete data
      const completeData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Complete complaint',
        hpi: 'This is a very detailed history of present illness that is definitely longer than 50 characters and provides comprehensive information',
        recordsCheckCompleted: true,
        medications: ['Med1', 'Med2'],
        allergies: ['Allergy1'],
        pastMedicalHistory: ['History1'],
        familyHistory: 'Family history',
        socialHistory: 'Social history'
      };
      
      const completeAgent = determineAgent(completeData);
      const completeStage = agentToStage(completeAgent);
      
      expect(completeAgent).toBe('HandoverSpecialist');
      expect(completeStage).toBe('summary');
    });

    it('should be deterministic - same input should always produce same output', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (data) => {
          const agent1 = determineAgent(data);
          const agent2 = determineAgent(data);
          const stage1 = agentToStage(agent1);
          const stage2 = agentToStage(agent2);
          
          expect(agent1).toBe(agent2);
          expect(stage1).toBe(stage2);
          
          const completeness1 = calculateCompleteness(data);
          const completeness2 = calculateCompleteness(data);
          
          expect(completeness1).toBe(completeness2);
        }
      ));
    });
  });
});