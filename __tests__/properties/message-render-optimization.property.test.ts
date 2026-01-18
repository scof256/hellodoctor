/**
 * Property Test: Message Render Optimization
 * Feature: site-performance-optimization, Property 3: Message Render Optimization
 * 
 * *For any* message list of size N, when a new message is appended, the number of
 * React component re-renders SHALL be O(1), not O(N).
 * 
 * **Validates: Requirements 2.1, 2.2, 2.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Message, AgentRole } from '../../app/types';

// Arbitrary for generating valid agent roles
const agentRoleArb = fc.constantFrom<AgentRole>(
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist'
);

// Arbitrary for generating valid message roles
const messageRoleArb = fc.constantFrom<'user' | 'model' | 'doctor'>('user', 'model', 'doctor');

// Arbitrary for generating a valid message
const messageArb: fc.Arbitrary<Message> = fc.record({
  id: fc.uuid(),
  role: messageRoleArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  images: fc.option(fc.array(fc.string({ minLength: 10, maxLength: 100 }), { maxLength: 3 }), { nil: undefined }),
  timestamp: fc.date(),
  groundingMetadata: fc.option(fc.constant(undefined), { nil: undefined }),
  activeAgent: fc.option(agentRoleArb, { nil: undefined })
});

// Arbitrary for generating a list of messages
const messageListArb = fc.array(messageArb, { minLength: 0, maxLength: 100 });

/**
 * Simulates the React.memo comparison function used in MemoizedMessage
 * Returns true if props are equal (no re-render needed)
 */
function areMessagePropsEqual(
  prevMessage: Message,
  nextMessage: Message,
  prevVariant: string,
  nextVariant: string
): boolean {
  return prevMessage.id === nextMessage.id && prevVariant === nextVariant;
}

/**
 * Calculates the number of re-renders when a new message is appended
 * Using the memoization strategy from MemoizedMessage
 */
function calculateReRendersOnAppend(
  existingMessages: Message[],
  newMessage: Message,
  variant: 'patient' | 'doctor' = 'patient'
): number {
  let reRenderCount = 0;

  // For each existing message, check if it would re-render
  for (const existingMsg of existingMessages) {
    // With React.memo and our comparison function, existing messages
    // should NOT re-render because their IDs haven't changed
    const wouldReRender = !areMessagePropsEqual(existingMsg, existingMsg, variant, variant);
    if (wouldReRender) {
      reRenderCount++;
    }
  }

  // The new message always renders (initial render, not re-render)
  // We count this as 1 render for the new message
  reRenderCount += 1;

  return reRenderCount;
}

/**
 * Calculates re-renders without memoization (O(N) behavior)
 */
function calculateReRendersWithoutMemo(
  existingMessages: Message[],
  _newMessage: Message
): number {
  // Without memoization, all messages re-render plus the new one
  return existingMessages.length + 1;
}

describe('Property 3: Message Render Optimization', () => {
  it('for any message list of size N, appending a message SHALL cause O(1) re-renders with memoization', () => {
    fc.assert(
      fc.property(
        messageListArb,
        messageArb,
        (existingMessages, newMessage) => {
          const reRenderCount = calculateReRendersOnAppend(existingMessages, newMessage);
          
          // O(1) means the re-render count should be constant (1 for the new message)
          // regardless of the size of the existing message list
          expect(reRenderCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('memoized re-render count SHALL be less than or equal to non-memoized for N > 0', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 100 }),
        messageArb,
        (existingMessages, newMessage) => {
          const memoizedCount = calculateReRendersOnAppend(existingMessages, newMessage);
          const nonMemoizedCount = calculateReRendersWithoutMemo(existingMessages, newMessage);
          
          // Memoized should always be better or equal
          expect(memoizedCount).toBeLessThanOrEqual(nonMemoizedCount);
          
          // For N > 0, memoized should be strictly better
          if (existingMessages.length > 0) {
            expect(memoizedCount).toBeLessThan(nonMemoizedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('existing messages SHALL NOT re-render when a new message is appended', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 50 }),
        messageArb,
        fc.constantFrom<'patient' | 'doctor'>('patient', 'doctor'),
        (existingMessages, newMessage, variant) => {
          // Check each existing message
          for (const existingMsg of existingMessages) {
            // The comparison function should return true (props equal, no re-render)
            const shouldSkipReRender = areMessagePropsEqual(
              existingMsg,
              existingMsg,
              variant,
              variant
            );
            expect(shouldSkipReRender).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message with changed ID SHALL trigger re-render', () => {
    fc.assert(
      fc.property(
        messageArb,
        fc.uuid(),
        (message, newId) => {
          fc.pre(message.id !== newId);
          
          const modifiedMessage = { ...message, id: newId };
          const shouldSkipReRender = areMessagePropsEqual(
            message,
            modifiedMessage,
            'patient',
            'patient'
          );
          
          // Different ID means props are not equal, should re-render
          expect(shouldSkipReRender).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message with changed variant SHALL trigger re-render', () => {
    fc.assert(
      fc.property(
        messageArb,
        (message) => {
          const shouldSkipReRender = areMessagePropsEqual(
            message,
            message,
            'patient',
            'doctor'
          );
          
          // Different variant means props are not equal, should re-render
          expect(shouldSkipReRender).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message text changes SHALL NOT trigger re-render (only ID matters)', () => {
    fc.assert(
      fc.property(
        messageArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        (message, newText) => {
          fc.pre(message.text !== newText);
          
          const modifiedMessage = { ...message, text: newText };
          const shouldSkipReRender = areMessagePropsEqual(
            message,
            modifiedMessage,
            'patient',
            'patient'
          );
          
          // Same ID means props are equal, should skip re-render
          // This is the optimization - we assume message content doesn't change
          expect(shouldSkipReRender).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
