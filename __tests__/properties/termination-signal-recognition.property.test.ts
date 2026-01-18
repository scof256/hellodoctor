/**
 * Property Test: Termination Signal Recognition
 * 
 * For any patient message containing a termination signal (completion phrase,
 * explicit finish request, or done command), the system should transition to
 * HandoverSpecialist or booking flow within 1 message.
 * 
 * Feature: intake-termination-fix, Property 1: Termination Signal Recognition
 * Validates: Requirements 1.2, 2.1, 3.3, 6.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectTerminationSignal,
  TERMINATION_PHRASES,
  MESSAGE_LIMITS,
} from '@/server/services/question-tracking';
import type { AgentRole } from '@/types';

const VALID_AGENTS: AgentRole[] = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist',
];

// Arbitrary for generating random agent roles
const agentArb = fc.constantFrom(...VALID_AGENTS);

// Arbitrary for generating completion phrases
const completionPhraseArb = fc.constantFrom(...TERMINATION_PHRASES.completion);

// Arbitrary for generating explicit finish phrases
const explicitFinishArb = fc.constantFrom(...TERMINATION_PHRASES.explicit_finish);

// Arbitrary for generating skip commands
const skipCommandArb = fc.constantFrom(...TERMINATION_PHRASES.skip);

// Arbitrary for generating done commands
const doneCommandArb = fc.constantFrom(...TERMINATION_PHRASES.done);

describe('Property 1: Termination Signal Recognition', () => {
  it('should detect done commands and transition to HandoverSpecialist', () => {
    fc.assert(
      fc.property(
        doneCommandArb,
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 100 }),
        (doneCommand, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            doneCommand,
            currentAgent,
            aiMessageCount,
            completeness,
            true, // hasChiefComplaint
            true  // hasHpi
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('done_command');
          expect(result.targetAgent).toBe('HandoverSpecialist');
          expect(result.acknowledgment).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect skip commands and advance to next agent', () => {
    fc.assert(
      fc.property(
        skipCommandArb,
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 59 }),
        (skipCommand, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            skipCommand,
            currentAgent,
            aiMessageCount,
            completeness,
            false, // hasChiefComplaint
            false  // hasHpi
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('skip_command');
          expect(result.targetAgent).not.toBeNull();
          expect(result.acknowledgment).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect explicit finish requests and transition to HandoverSpecialist', () => {
    // Filter out phrases that overlap with done commands (done commands have higher priority)
    const nonOverlappingFinishPhrases = TERMINATION_PHRASES.explicit_finish.filter(phrase => 
      !TERMINATION_PHRASES.done.some(donePhrase => phrase.toLowerCase().includes(donePhrase))
    );
    
    fc.assert(
      fc.property(
        fc.constantFrom(...nonOverlappingFinishPhrases),
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 100 }),
        (finishPhrase, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            finishPhrase,
            currentAgent,
            aiMessageCount,
            completeness,
            true,
            true
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('explicit_request');
          expect(result.targetAgent).toBe('HandoverSpecialist');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect completion phrases when completeness >= 60%', () => {
    fc.assert(
      fc.property(
        completionPhraseArb,
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 60, max: 100 }),
        (completionPhrase, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            completionPhrase,
            currentAgent,
            aiMessageCount,
            completeness,
            true,
            true
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('completion_phrase');
          expect(result.targetAgent).toBe('HandoverSpecialist');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect completion phrases when chiefComplaint and hpi are present', () => {
    fc.assert(
      fc.property(
        completionPhraseArb,
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 59 }), // Low completeness
        (completionPhrase, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            completionPhrase,
            currentAgent,
            aiMessageCount,
            completeness,
            true,  // hasChiefComplaint
            true   // hasHpi
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('completion_phrase');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should force handover when AI message count reaches limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: MESSAGE_LIMITS.FORCE_HANDOVER, max: 50 }),
        fc.integer({ min: 0, max: 59 }),
        (message, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            message,
            currentAgent,
            aiMessageCount,
            completeness,
            false,
            false
          );
          
          expect(result.shouldTerminate).toBe(true);
          expect(result.reason).toBe('message_limit');
          expect(result.targetAgent).toBe('HandoverSpecialist');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger completeness threshold at 80%', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
          !TERMINATION_PHRASES.done.some(p => s.toLowerCase().includes(p)) &&
          !TERMINATION_PHRASES.skip.some(p => s.toLowerCase().includes(p)) &&
          !TERMINATION_PHRASES.explicit_finish.some(p => s.toLowerCase().includes(p)) &&
          !TERMINATION_PHRASES.completion.some(p => s.toLowerCase().includes(p))
        ),
        agentArb.filter(a => a !== 'HandoverSpecialist'),
        fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
        fc.integer({ min: 80, max: 100 }),
        (message, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            message,
            currentAgent,
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

  it('should not terminate for regular messages below thresholds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }).filter(s => {
          const lower = s.toLowerCase();
          return !TERMINATION_PHRASES.done.some(p => lower === p || lower.startsWith(p + ' ')) &&
                 !TERMINATION_PHRASES.skip.some(p => lower === p || lower.startsWith(p + ' ')) &&
                 !TERMINATION_PHRASES.explicit_finish.some(p => lower.includes(p)) &&
                 !TERMINATION_PHRASES.completion.some(p => lower.includes(p));
        }),
        agentArb,
        fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
        fc.integer({ min: 0, max: 79 }),
        (message, currentAgent, aiMessageCount, completeness) => {
          const result = detectTerminationSignal(
            message,
            currentAgent,
            aiMessageCount,
            completeness,
            false,
            false
          );
          
          expect(result.shouldTerminate).toBe(false);
          expect(result.reason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
