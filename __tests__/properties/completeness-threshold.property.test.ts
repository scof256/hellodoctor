/**
 * Property Test: Completeness Threshold Behavior
 * 
 * For any intake session, the system should handle completeness thresholds:
 * - Allow termination at 60% with termination signal
 * - Offer conclusion at 80% completeness
 * - Allow early termination with chiefComplaint + HPI + 50% completeness
 * 
 * Feature: intake-termination-fix, Property 5: Completeness Threshold Behavior
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectTerminationSignal,
  TERMINATION_PHRASES,
  MESSAGE_LIMITS,
} from '@/server/services/question-tracking';
import type { AgentRole } from '@/types';

const NON_HANDOVER_AGENTS: AgentRole[] = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
];

// Arbitrary for generating non-handover agent roles
const nonHandoverAgentArb = fc.constantFrom(...NON_HANDOVER_AGENTS);

// Arbitrary for generating completion phrases
const completionPhraseArb = fc.constantFrom(...TERMINATION_PHRASES.completion);

describe('Property 5: Completeness Threshold Behavior', () => {
  describe('60% Completeness with Termination Signal', () => {
    it('should allow termination at 60%+ completeness with completion phrase', () => {
      fc.assert(
        fc.property(
          completionPhraseArb,
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 60, max: 79 }), // 60-79% completeness
          (phrase, agent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              phrase,
              agent,
              aiMessageCount,
              completeness,
              true, // hasChiefComplaint
              true  // hasHpi
            );
            
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('completion_phrase');
            expect(result.targetAgent).toBe('HandoverSpecialist');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not terminate at low completeness without essential data', () => {
      fc.assert(
        fc.property(
          completionPhraseArb,
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 0, max: 59 }), // Below 60% completeness
          (phrase, agent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              phrase,
              agent,
              aiMessageCount,
              completeness,
              false, // no chiefComplaint
              false  // no hpi
            );
            
            // Should not terminate on completion phrase alone without data
            expect(result.shouldTerminate).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('80% Completeness Auto-Offer', () => {
    it('should trigger completeness threshold at 80%+ for non-termination messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }).filter(s => {
            const lower = s.toLowerCase();
            return !TERMINATION_PHRASES.done.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.skip.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.explicit_finish.some(p => lower.includes(p)) &&
                   !TERMINATION_PHRASES.completion.some(p => lower.includes(p));
          }),
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 80, max: 100 }),
          (message, agent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              message,
              agent,
              aiMessageCount,
              completeness,
              true,
              true
            );
            
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('completeness_threshold');
            expect(result.targetAgent).toBe('HandoverSpecialist');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger completeness threshold below 80%', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }).filter(s => {
            const lower = s.toLowerCase();
            return !TERMINATION_PHRASES.done.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.skip.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.explicit_finish.some(p => lower.includes(p)) &&
                   !TERMINATION_PHRASES.completion.some(p => lower.includes(p));
          }),
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 0, max: 79 }),
          (message, agent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              message,
              agent,
              aiMessageCount,
              completeness,
              false,
              false
            );
            
            expect(result.shouldTerminate).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Early Termination with Essential Data', () => {
    it('should allow termination with chiefComplaint + HPI even at low completeness', () => {
      fc.assert(
        fc.property(
          completionPhraseArb,
          nonHandoverAgentArb,
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 0, max: 59 }), // Low completeness
          (phrase, agent, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              phrase,
              agent,
              aiMessageCount,
              completeness,
              true,  // hasChiefComplaint
              true   // hasHpi
            );
            
            // Should terminate because we have essential data
            expect(result.shouldTerminate).toBe(true);
            expect(result.reason).toBe('completion_phrase');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('HandoverSpecialist Exclusion', () => {
    it('should not trigger completeness threshold when already at HandoverSpecialist', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }).filter(s => {
            const lower = s.toLowerCase();
            return !TERMINATION_PHRASES.done.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.skip.some(p => lower === p || lower.startsWith(p + ' ')) &&
                   !TERMINATION_PHRASES.explicit_finish.some(p => lower.includes(p)) &&
                   !TERMINATION_PHRASES.completion.some(p => lower.includes(p));
          }),
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          fc.integer({ min: 80, max: 100 }),
          (message, aiMessageCount, completeness) => {
            const result = detectTerminationSignal(
              message,
              'HandoverSpecialist',
              aiMessageCount,
              completeness,
              true,
              true
            );
            
            // Should not trigger completeness threshold when already at HandoverSpecialist
            expect(result.reason).not.toBe('completeness_threshold');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
