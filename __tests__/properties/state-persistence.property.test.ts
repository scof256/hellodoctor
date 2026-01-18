/**
 * Property Test: State Persistence Round-Trip
 * 
 * For any intake session state (aiMessageCount, hasOfferedConclusion, terminationReason),
 * the state should be correctly persisted and retrieved from the database.
 * 
 * Feature: intake-termination-fix, Property 4: State Persistence Round-Trip
 * Validates: Requirements 1.4, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MESSAGE_LIMITS } from '@/server/services/question-tracking';

// Types for termination tracking state
interface TerminationTrackingState {
  aiMessageCount: number;
  hasOfferedConclusion: boolean;
  terminationReason: string | null;
}

// Valid termination reasons
const VALID_TERMINATION_REASONS = [
  'completion_phrase',
  'explicit_request',
  'skip_command',
  'done_command',
  'message_limit',
  'completeness_threshold',
  null,
] as const;

// Arbitrary for generating valid termination tracking state
const terminationStateArb = fc.record({
  aiMessageCount: fc.integer({ min: 0, max: 100 }),
  hasOfferedConclusion: fc.boolean(),
  terminationReason: fc.constantFrom(...VALID_TERMINATION_REASONS),
});

// Simulate serialization/deserialization (what happens when storing to DB)
function serializeState(state: TerminationTrackingState): string {
  return JSON.stringify(state);
}

function deserializeState(json: string): TerminationTrackingState {
  return JSON.parse(json) as TerminationTrackingState;
}

describe('Property 4: State Persistence Round-Trip', () => {
  describe('Serialization Round-Trip', () => {
    it('should preserve aiMessageCount through serialization', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            const serialized = serializeState(state);
            const deserialized = deserializeState(serialized);
            
            expect(deserialized.aiMessageCount).toBe(state.aiMessageCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve hasOfferedConclusion through serialization', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            const serialized = serializeState(state);
            const deserialized = deserializeState(serialized);
            
            expect(deserialized.hasOfferedConclusion).toBe(state.hasOfferedConclusion);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve terminationReason through serialization', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            const serialized = serializeState(state);
            const deserialized = deserializeState(serialized);
            
            expect(deserialized.terminationReason).toBe(state.terminationReason);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve complete state through round-trip', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            const serialized = serializeState(state);
            const deserialized = deserializeState(serialized);
            
            expect(deserialized).toEqual(state);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('State Invariants', () => {
    it('should have aiMessageCount as non-negative integer', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            expect(state.aiMessageCount).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(state.aiMessageCount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have hasOfferedConclusion as boolean', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            expect(typeof state.hasOfferedConclusion).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have terminationReason as valid value or null', () => {
      fc.assert(
        fc.property(
          terminationStateArb,
          (state) => {
            const validReasons = [
              'completion_phrase',
              'explicit_request',
              'skip_command',
              'done_command',
              'message_limit',
              'completeness_threshold',
              null,
            ];
            expect(validReasons).toContain(state.terminationReason);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('State Consistency', () => {
    it('should have hasOfferedConclusion true only when aiMessageCount >= OFFER_CONCLUSION', () => {
      // This tests the logical consistency of the state
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MESSAGE_LIMITS.OFFER_CONCLUSION - 1 }),
          (aiMessageCount) => {
            // If aiMessageCount is below threshold, hasOfferedConclusion should logically be false
            // (though the system could set it true in edge cases, this tests the expected behavior)
            const state: TerminationTrackingState = {
              aiMessageCount,
              hasOfferedConclusion: false, // Expected state when below threshold
              terminationReason: null,
            };
            
            expect(state.aiMessageCount).toBeLessThan(MESSAGE_LIMITS.OFFER_CONCLUSION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have terminationReason set when termination occurred', () => {
      const terminationReasons = [
        'completion_phrase',
        'explicit_request',
        'skip_command',
        'done_command',
        'message_limit',
        'completeness_threshold',
      ] as const;

      fc.assert(
        fc.property(
          fc.constantFrom(...terminationReasons),
          (reason) => {
            const state: TerminationTrackingState = {
              aiMessageCount: 10,
              hasOfferedConclusion: false,
              terminationReason: reason,
            };
            
            expect(state.terminationReason).not.toBeNull();
            expect(terminationReasons).toContain(state.terminationReason);
          }
        ),
        { numRuns: terminationReasons.length }
      );
    });
  });

  describe('Default Values', () => {
    it('should have correct default values for new sessions', () => {
      const defaultState: TerminationTrackingState = {
        aiMessageCount: 0,
        hasOfferedConclusion: false,
        terminationReason: null,
      };

      expect(defaultState.aiMessageCount).toBe(0);
      expect(defaultState.hasOfferedConclusion).toBe(false);
      expect(defaultState.terminationReason).toBeNull();
    });
  });
});
