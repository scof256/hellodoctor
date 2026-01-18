/**
 * Property Test: Skip Command Handling
 * 
 * For any skip command ("skip", "next", "move on"), the system should
 * immediately advance to the next agent without calling AI.
 * 
 * Feature: intake-termination-fix, Property 6: Skip Command Handling
 * Validates: Requirements 6.1, 6.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectTerminationSignal,
  getNextAgentOnLimitReached,
  TERMINATION_PHRASES,
} from '@/server/services/question-tracking';
import type { AgentRole } from '@/types';

const VALID_AGENTS: AgentRole[] = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist',
];

const NON_HANDOVER_AGENTS: AgentRole[] = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
];

// Arbitrary for generating skip commands
const skipCommandArb = fc.constantFrom(...TERMINATION_PHRASES.skip);

// Arbitrary for generating non-handover agent roles
const nonHandoverAgentArb = fc.constantFrom(...NON_HANDOVER_AGENTS);

describe('Property 6: Skip Command Handling', () => {
  describe('Skip Command Detection', () => {
    it('should detect all configured skip commands', () => {
      fc.assert(
        fc.property(
          skipCommandArb,
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: 19 }),
          fc.integer({ min: 0, max: 100 }),
          (skipCommand, currentAgent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              skipCommand,
              currentAgent,
              aiMessageCount,
              completeness,
              false,
              false
            );
            
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('skip_command');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect skip commands with trailing text', () => {
      fc.assert(
        fc.property(
          skipCommandArb,
          fc.string({ minLength: 1, maxLength: 20 }),
          nonHandoverAgentArb,
          (skipCommand, suffix, currentAgent) => {
            const message = `${skipCommand} ${suffix}`;
            const result = detectTerminationSignal(
              message,
              currentAgent,
              0,
              50,
              true,
              true
            );
            
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('skip_command');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Agent Advancement', () => {
    it('should advance to the correct next agent on skip', () => {
      const expectedNextAgents: Record<AgentRole, AgentRole> = {
        'Triage': 'ClinicalInvestigator',
        'ClinicalInvestigator': 'RecordsClerk',
        'RecordsClerk': 'HistorySpecialist',
        'HistorySpecialist': 'HandoverSpecialist',
        'HandoverSpecialist': 'HandoverSpecialist',
      };

      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_AGENTS),
          (currentAgent) => {
            const nextAgent = getNextAgentOnLimitReached(currentAgent);
            expect(nextAgent).toBe(expectedNextAgents[currentAgent]);
          }
        ),
        { numRuns: VALID_AGENTS.length }
      );
    });

    it('should set targetAgent to next agent on skip command', () => {
      fc.assert(
        fc.property(
          skipCommandArb,
          nonHandoverAgentArb,
          (skipCommand, currentAgent) => {
            const result = detectTerminationSignal(
              skipCommand,
              currentAgent,
              0,
              50,
              true,
              true
            );
            
            const expectedNext = getNextAgentOnLimitReached(currentAgent);
            expect(result.targetAgent).toBe(expectedNext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Acknowledgment Messages', () => {
    it('should provide acknowledgment message on skip', () => {
      fc.assert(
        fc.property(
          skipCommandArb,
          nonHandoverAgentArb,
          (skipCommand, currentAgent) => {
            const result = detectTerminationSignal(
              skipCommand,
              currentAgent,
              0,
              50,
              true,
              true
            );
            
            expect(result.acknowledgment).toBeTruthy();
            expect(typeof result.acknowledgment).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mention "final review" when skipping to HandoverSpecialist', () => {
      // HistorySpecialist is the last agent before HandoverSpecialist
      const result = detectTerminationSignal(
        'skip',
        'HistorySpecialist',
        0,
        50,
        true,
        true
      );
      
      expect(result.acknowledgment).toContain('final review');
    });

    it('should mention "next section" when not skipping to HandoverSpecialist', () => {
      // Triage skips to ClinicalInvestigator
      const result = detectTerminationSignal(
        'skip',
        'Triage',
        0,
        50,
        true,
        true
      );
      
      expect(result.acknowledgment).toContain('next section');
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect skip commands regardless of case', () => {
      const caseVariations = ['SKIP', 'Skip', 'sKiP', 'NEXT', 'Next', 'MOVE ON', 'Move On'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...caseVariations),
          nonHandoverAgentArb,
          (skipCommand, currentAgent) => {
            const result = detectTerminationSignal(
              skipCommand,
              currentAgent,
              0,
              50,
              true,
              true
            );
            
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('skip_command');
          }
        ),
        { numRuns: caseVariations.length * NON_HANDOVER_AGENTS.length }
      );
    });
  });
});
