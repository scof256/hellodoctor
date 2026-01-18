/**
 * Feature: a2a-protocol-progression-fix, Property 1: Deterministic Agent Routing
 * 
 * For any medical data state, the agent routing function should always return the same agent 
 * when called multiple times with identical input data
 * 
 * Validates: Requirements 1.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { determineAgent, ROUTING_PRIORITY } from '@/app/lib/agent-router';
import { MedicalData, AgentRole, INITIAL_MEDICAL_DATA } from '@/app/types';

// Arbitrary generators for medical data
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
  currentAgent: fc.constantFrom('Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist') as fc.Arbitrary<AgentRole>,
  clinicalHandover: fc.constant(null),
  ucgRecommendations: fc.option(fc.string(), { nil: null }),
  bookingStatus: fc.constantFrom('collecting', 'ready', 'booked') as fc.Arbitrary<'collecting' | 'ready' | 'booked'>
}) as fc.Arbitrary<MedicalData>;

describe('Property 1: Deterministic Agent Routing', () => {
  it('agent routing is deterministic for identical input', () => {
    fc.assert(
      fc.property(
        arbitraryMedicalData,
        (medicalData) => {
          const result1 = determineAgent(medicalData);
          const result2 = determineAgent(medicalData);
          const result3 = determineAgent(medicalData);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('agent routing returns valid agent roles', () => {
    fc.assert(
      fc.property(
        arbitraryMedicalData,
        (medicalData) => {
          const result = determineAgent(medicalData);
          const validAgents: AgentRole[] = ['Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist'];
          expect(validAgents).toContain(result);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty medical data always routes to Triage', () => {
    const emptyData = { ...INITIAL_MEDICAL_DATA };
    const result = determineAgent(emptyData);
    expect(result).toBe('Triage');
  });

  it('medical data with only chief complaint routes to ClinicalInvestigator', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (chiefComplaint) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint
          };
          const result = determineAgent(medicalData);
          expect(result).toBe('ClinicalInvestigator');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('medical data with sufficient HPI but no records check routes to RecordsClerk', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 50 }).filter(s => s.trim().length >= 50),
        (chiefComplaint, hpi) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint,
            hpi,
            recordsCheckCompleted: false
          };
          const result = determineAgent(medicalData);
          expect(result).toBe('RecordsClerk');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: a2a-protocol-progression-fix, Property 2: Agent Routing Priority Logic
 * 
 * For any medical data state, the selected agent should follow the priority hierarchy: 
 * Triage (no chief complaint) → ClinicalInvestigator (insufficient HPI) → RecordsClerk (records incomplete) 
 * → HistorySpecialist (history missing) → HandoverSpecialist (complete data)
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4
 */
describe('Property 2: Agent Routing Priority Logic', () => {
  it('Triage has highest priority when chief complaint is missing', () => {
    fc.assert(
      fc.property(
        arbitraryMedicalData,
        (medicalData) => {
          // Force chief complaint to be empty
          const dataWithoutChiefComplaint = {
            ...medicalData,
            chiefComplaint: null
          };
          
          const result = determineAgent(dataWithoutChiefComplaint);
          expect(result).toBe('Triage');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ClinicalInvestigator is selected when chief complaint exists but HPI is insufficient', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ maxLength: 49 }).filter(s => s.trim().length < 50), { nil: null }),
        (chiefComplaint, shortHpi) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint,
            hpi: shortHpi
          };
          
          const result = determineAgent(medicalData);
          expect(result).toBe('ClinicalInvestigator');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('RecordsClerk is selected when HPI is sufficient but records not checked', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 50 }).filter(s => s.trim().length >= 50),
        (chiefComplaint, longHpi) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint,
            hpi: longHpi,
            recordsCheckCompleted: false
          };
          
          const result = determineAgent(medicalData);
          expect(result).toBe('RecordsClerk');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('HistorySpecialist is selected when records checked but history missing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 50 }).filter(s => s.trim().length >= 50),
        (chiefComplaint, longHpi) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint,
            hpi: longHpi,
            recordsCheckCompleted: true,
            medications: [], // Empty history data
            allergies: [],
            pastMedicalHistory: []
          };
          
          const result = determineAgent(medicalData);
          expect(result).toBe('HistorySpecialist');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('HandoverSpecialist is selected when all data is complete', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 50 }).filter(s => s.trim().length >= 50),
        fc.array(fc.string().filter(s => s.trim().length > 0), { minLength: 1 }),
        (chiefComplaint, longHpi, medications) => {
          const medicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint,
            hpi: longHpi,
            recordsCheckCompleted: true,
            medications // Has some history data
          };
          
          const result = determineAgent(medicalData);
          expect(result).toBe('HandoverSpecialist');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('routing priority matrix matches actual routing function', () => {
    fc.assert(
      fc.property(
        arbitraryMedicalData,
        (medicalData) => {
          const actualResult = determineAgent(medicalData);
          
          // Check that the routing priority matrix correctly identifies the selected agent
          const priorityResult = ROUTING_PRIORITY[actualResult](medicalData);
          
          // The priority function for the selected agent should return true
          // OR it should be the fallback case (HandoverSpecialist when no other conditions match)
          if (actualResult === 'HandoverSpecialist') {
            // HandoverSpecialist can be selected either because it matches its condition
            // or because it's the fallback when no other conditions match
            expect(priorityResult || (
              !ROUTING_PRIORITY.Triage(medicalData) &&
              !ROUTING_PRIORITY.ClinicalInvestigator(medicalData) &&
              !ROUTING_PRIORITY.RecordsClerk(medicalData) &&
              !ROUTING_PRIORITY.HistorySpecialist(medicalData)
            )).toBe(true);
          } else {
            expect(priorityResult).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});