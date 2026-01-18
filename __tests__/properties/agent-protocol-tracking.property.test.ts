/**
 * Property-based tests for Agent Protocol Tracking State
 * Tests the tracking state injection into agent prompts
 * 
 * Requirements validated:
 * - Property 1: Placeholder Replacement Completeness (2.1, 2.2, 2.3)
 * - Property 2: Answered Topics Formatting (2.4, 2.5, 4.1)
 * - Property 3: Follow-Up Limit Instructions (3.1, 3.2, 3.3, 3.4)
 * - Property 4: Message Limit Instructions (5.1, 5.2)
 * - Property 5: Tracking State Forwarding (1.1, 1.2, 6.1-6.5)
 * - Property 6: Backward Compatibility (1.3, 1.4)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TrackingState, AgentRole, FollowUpCounts } from '@/types';
import { DEFAULT_TRACKING_STATE, VALID_AGENT_ROLES } from '@/types';
import {
  formatAnsweredTopics,
  getAgentFollowUpCount,
  buildDynamicInstructions,
  injectTrackingState,
} from '@/server/services/tracking-state-utils';

// --- ARBITRARIES ---

const agentRoleArb = fc.constantFrom<AgentRole>(...VALID_AGENT_ROLES);

const followUpCountsArb = fc.record({
  triage: fc.nat({ max: 5 }),
  symptoms: fc.nat({ max: 5 }),
  records: fc.nat({ max: 5 }),
  history: fc.nat({ max: 5 }),
  review: fc.nat({ max: 5 }),
}) as fc.Arbitrary<FollowUpCounts>;

const answeredTopicsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { minLength: 0, maxLength: 10 }
);

const trackingStateArb: fc.Arbitrary<TrackingState> = fc.record({
  followUpCounts: followUpCountsArb,
  answeredTopics: answeredTopicsArb,
  aiMessageCount: fc.nat({ max: 30 }),
  completeness: fc.nat({ max: 100 }),
  currentAgent: agentRoleArb,
});

// Sample prompt with all placeholders
const SAMPLE_PROMPT_WITH_PLACEHOLDERS = `
You are the **Clinical Investigator Agent**.

**ALREADY ANSWERED (DO NOT ASK AGAIN):**
{answeredQuestions}

**FOLLOW-UP COUNT:** {followUpCount}/2
**TOTAL AI MESSAGES:** {aiMessageCount}/20
**INTAKE COMPLETENESS:** {completeness}

**OUTPUT FORMAT:**
Return JSON response.
`;

// --- PROPERTY 1: Placeholder Replacement Completeness ---
describe('Property 1: Placeholder Replacement Completeness', () => {
  it('should replace all placeholders with actual values for any tracking state', () => {
    fc.assert(
      fc.property(trackingStateArb, (trackingState) => {
        const result = injectTrackingState(SAMPLE_PROMPT_WITH_PLACEHOLDERS, trackingState);
        
        // No unreplaced placeholders should remain
        expect(result).not.toContain('{answeredQuestions}');
        expect(result).not.toContain('{followUpCount}');
        expect(result).not.toContain('{aiMessageCount}');
        expect(result).not.toContain('{completeness}');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle prompts with multiple occurrences of the same placeholder', () => {
    const promptWithDuplicates = `
      {answeredQuestions}
      Some text
      {answeredQuestions}
      {followUpCount} and {followUpCount}
    `;
    
    fc.assert(
      fc.property(trackingStateArb, (trackingState) => {
        const result = injectTrackingState(promptWithDuplicates, trackingState);
        
        expect(result).not.toContain('{answeredQuestions}');
        expect(result).not.toContain('{followUpCount}');
      }),
      { numRuns: 50 }
    );
  });
});

// --- PROPERTY 2: Answered Topics Formatting ---
describe('Property 2: Answered Topics Formatting', () => {
  it('should return "None yet" message for empty topics array', () => {
    const result = formatAnsweredTopics([]);
    expect(result).toBe('None yet - this is the start of the conversation');
  });

  it('should format non-empty topics as bulleted list', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
        (topics) => {
          const result = formatAnsweredTopics(topics);
          
          // Each topic should appear as a bullet point
          topics.forEach(topic => {
            expect(result).toContain(`• ${topic}`);
          });
          
          // Should not contain the "None yet" message
          expect(result).not.toContain('None yet');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null/undefined gracefully', () => {
    expect(formatAnsweredTopics(null)).toBe('None yet - this is the start of the conversation');
    expect(formatAnsweredTopics(undefined)).toBe('None yet - this is the start of the conversation');
  });
});

// --- PROPERTY 3: Follow-Up Limit Instructions ---
describe('Property 3: Follow-Up Limit Instructions', () => {
  it('should include wrap-up instructions when followUpCount >= 2', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => {
          const count = getAgentFollowUpCount(state.followUpCounts, state.currentAgent);
          return count >= 2;
        }),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          // Should contain wrap-up warning
          expect(instructions).toContain('FOLLOW-UP LIMIT REACHED');
          expect(instructions).toContain('wrap up');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include "1 more follow-up" message when count is 1', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => {
          const count = getAgentFollowUpCount(state.followUpCounts, state.currentAgent);
          return count === 1;
        }),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).toContain('1/2');
          expect(instructions).toContain('ONE more follow-up');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not include follow-up warnings when count is 0', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => {
          const count = getAgentFollowUpCount(state.followUpCounts, state.currentAgent);
          return count === 0;
        }),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).not.toContain('FOLLOW-UP LIMIT');
          expect(instructions).not.toContain('1/2');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// --- PROPERTY 4: Message Limit Instructions ---
describe('Property 4: Message Limit Instructions', () => {
  it('should include handover instruction when aiMessageCount > 20', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => state.aiMessageCount > 20),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).toContain('MESSAGE LIMIT EXCEEDED');
          expect(instructions).toContain('HandoverSpecialist');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include conclusion offer when aiMessageCount > 15 and <= 20', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => state.aiMessageCount > 15 && state.aiMessageCount <= 20),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).toContain('Approaching message limit');
          expect(instructions).toContain('conclude');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not include message warnings when count <= 15', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => state.aiMessageCount <= 15),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).not.toContain('MESSAGE LIMIT');
          expect(instructions).not.toContain('Approaching message limit');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include completeness instruction when >= 80%', () => {
    fc.assert(
      fc.property(
        trackingStateArb.filter(state => state.completeness >= 80),
        (trackingState) => {
          const instructions = buildDynamicInstructions(trackingState);
          
          expect(instructions).toContain('80%+ complete');
          expect(instructions).toContain('wrap up');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// --- PROPERTY 5: Tracking State Forwarding ---
describe('Property 5: Tracking State Forwarding', () => {
  it('should correctly map agent roles to stage names for follow-up count lookup', () => {
    const agentToStageMap: Record<AgentRole, string> = {
      'Triage': 'triage',
      'ClinicalInvestigator': 'symptoms',
      'RecordsClerk': 'records',
      'HistorySpecialist': 'history',
      'HandoverSpecialist': 'review',
    };

    fc.assert(
      fc.property(agentRoleArb, followUpCountsArb, (agent, counts) => {
        const expectedStage = agentToStageMap[agent];
        const expectedCount = counts[expectedStage] ?? 0;
        const actualCount = getAgentFollowUpCount(counts, agent);
        
        expect(actualCount).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all tracking state values in injected prompt', () => {
    fc.assert(
      fc.property(trackingStateArb, (trackingState) => {
        const result = injectTrackingState(SAMPLE_PROMPT_WITH_PLACEHOLDERS, trackingState);
        
        // AI message count should appear
        expect(result).toContain(`${trackingState.aiMessageCount}`);
        
        // Completeness should appear with % sign
        expect(result).toContain(`${trackingState.completeness}%`);
        
        // Follow-up count for current agent should appear
        const followUpCount = getAgentFollowUpCount(
          trackingState.followUpCounts,
          trackingState.currentAgent
        );
        expect(result).toContain(`${followUpCount}`);
      }),
      { numRuns: 100 }
    );
  });
});

// --- PROPERTY 6: Backward Compatibility ---
describe('Property 6: Backward Compatibility', () => {
  it('should have sensible default tracking state', () => {
    expect(DEFAULT_TRACKING_STATE).toBeDefined();
    expect(DEFAULT_TRACKING_STATE.followUpCounts).toEqual({});
    expect(DEFAULT_TRACKING_STATE.answeredTopics).toEqual([]);
    expect(DEFAULT_TRACKING_STATE.aiMessageCount).toBe(0);
    expect(DEFAULT_TRACKING_STATE.completeness).toBe(0);
    expect(DEFAULT_TRACKING_STATE.currentAgent).toBe('Triage');
  });

  it('should handle default tracking state without errors', () => {
    const result = injectTrackingState(SAMPLE_PROMPT_WITH_PLACEHOLDERS, DEFAULT_TRACKING_STATE);
    
    // Should not throw and should produce valid output
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    
    // Should have replaced placeholders with defaults
    expect(result).toContain('None yet - this is the start of the conversation');
    expect(result).toContain('0/2'); // Follow-up count
    expect(result).toContain('0/20'); // AI message count
    expect(result).toContain('0%'); // Completeness
  });

  it('should handle empty/partial tracking state gracefully', () => {
    const partialState: TrackingState = {
      followUpCounts: {},
      answeredTopics: [],
      aiMessageCount: 0,
      completeness: 0,
      currentAgent: 'ClinicalInvestigator',
    };

    const result = injectTrackingState(SAMPLE_PROMPT_WITH_PLACEHOLDERS, partialState);
    
    expect(result).toBeDefined();
    expect(result).not.toContain('{answeredQuestions}');
    expect(result).not.toContain('{followUpCount}');
  });
});

// --- EDGE CASES ---
describe('Edge Cases', () => {
  it('should handle very long answered topics lists', () => {
    const longTopics = Array.from({ length: 50 }, (_, i) => `Topic ${i + 1}`);
    const result = formatAnsweredTopics(longTopics);
    
    expect(result.split('•').length - 1).toBe(50);
  });

  it('should handle special characters in topics', () => {
    const specialTopics = ['Topic with "quotes"', "Topic with 'apostrophe'", 'Topic with <html>'];
    const result = formatAnsweredTopics(specialTopics);
    
    specialTopics.forEach(topic => {
      expect(result).toContain(topic);
    });
  });

  it('should handle maximum values', () => {
    const maxState: TrackingState = {
      followUpCounts: { triage: 99, symptoms: 99, records: 99, history: 99, review: 99 },
      answeredTopics: Array.from({ length: 100 }, (_, i) => `Topic ${i}`),
      aiMessageCount: 999,
      completeness: 100,
      currentAgent: 'HandoverSpecialist',
    };

    const result = injectTrackingState(SAMPLE_PROMPT_WITH_PLACEHOLDERS, maxState);
    
    expect(result).toContain('999');
    expect(result).toContain('100%');
    expect(result).toContain('MESSAGE LIMIT EXCEEDED');
    expect(result).toContain('80%+ complete');
  });
});
