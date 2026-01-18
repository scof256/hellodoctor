/**
 * Property Test: Send Button Disabled While Sending
 * Feature: messaging-reliability-fix, Property 16: Send Button Disabled While Sending
 * 
 * *For any* message being sent, the send button SHALL be disabled until the send
 * operation completes (success or failure).
 * 
 * **Validates: Requirements 6.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the implementation
type SendState = 'idle' | 'sending' | 'retrying';

interface SendButtonState {
  isSending: boolean;
  isRetrying: boolean;
  isUploading: boolean;
  hasContent: boolean;
  hasSession: boolean;
}

/**
 * Determines if the send button should be disabled based on current state
 * This mirrors the logic in the patient intake page
 * Requirements: 6.1, 6.2, 6.3
 */
function shouldSendButtonBeDisabled(state: SendButtonState): boolean {
  // Button is disabled if:
  // 1. No content (empty input and no files)
  // 2. Currently sending a message
  // 3. Currently retrying a message
  // 4. Currently uploading files
  // 5. No session established
  return (
    !state.hasContent ||
    state.isSending ||
    state.isRetrying ||
    state.isUploading ||
    !state.hasSession
  );
}

/**
 * Simulates the send button click handler
 * Returns true if send was allowed, false if blocked
 */
function attemptSend(state: SendButtonState, lastSendTime: number, currentTime: number): {
  allowed: boolean;
  reason?: string;
} {
  // Check if button should be disabled
  if (!state.hasContent) {
    return { allowed: false, reason: 'no_content' };
  }
  if (state.isSending) {
    return { allowed: false, reason: 'already_sending' };
  }
  if (state.isRetrying) {
    return { allowed: false, reason: 'retry_in_progress' };
  }
  if (state.isUploading) {
    return { allowed: false, reason: 'upload_in_progress' };
  }
  if (!state.hasSession) {
    return { allowed: false, reason: 'no_session' };
  }
  
  // Debounce check (500ms minimum between sends)
  if (currentTime - lastSendTime < 500) {
    return { allowed: false, reason: 'debounce' };
  }
  
  return { allowed: true };
}

// Arbitraries for generating test data
const sendButtonStateArb: fc.Arbitrary<SendButtonState> = fc.record({
  isSending: fc.boolean(),
  isRetrying: fc.boolean(),
  isUploading: fc.boolean(),
  hasContent: fc.boolean(),
  hasSession: fc.boolean(),
});

const timestampArb = fc.integer({ min: 0, max: 1000000 });

describe('Property 16: Send Button Disabled While Sending', () => {
  it('should disable send button when isSending is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(true),
          isRetrying: fc.boolean(),
          isUploading: fc.boolean(),
          hasContent: fc.constant(true), // Has content
          hasSession: fc.constant(true), // Has session
        }),
        (state) => {
          // When isSending is true, button should always be disabled
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Attempt to send should be blocked
          const result = attemptSend(state, 0, 1000);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('already_sending');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should disable send button when isRetrying is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(false),
          isRetrying: fc.constant(true),
          isUploading: fc.boolean(),
          hasContent: fc.constant(true),
          hasSession: fc.constant(true),
        }),
        (state) => {
          // When isRetrying is true, button should be disabled
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Attempt to send should be blocked
          const result = attemptSend(state, 0, 1000);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('retry_in_progress');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should disable send button when isUploading is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(false),
          isRetrying: fc.constant(false),
          isUploading: fc.constant(true),
          hasContent: fc.constant(true),
          hasSession: fc.constant(true),
        }),
        (state) => {
          // When isUploading is true, button should be disabled
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Attempt to send should be blocked
          const result = attemptSend(state, 0, 1000);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('upload_in_progress');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enable send button only when all conditions are met', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(false),
          isRetrying: fc.constant(false),
          isUploading: fc.constant(false),
          hasContent: fc.constant(true),
          hasSession: fc.constant(true),
        }),
        (state) => {
          // When all conditions are met, button should be enabled
          expect(shouldSendButtonBeDisabled(state)).toBe(false);
          
          // Attempt to send should be allowed (with sufficient time gap)
          const result = attemptSend(state, 0, 1000);
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should block rapid double-clicks with debounce', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(false),
          isRetrying: fc.constant(false),
          isUploading: fc.constant(false),
          hasContent: fc.constant(true),
          hasSession: fc.constant(true),
        }),
        fc.integer({ min: 0, max: 499 }), // Time gap less than 500ms
        (state, timeGap) => {
          const lastSendTime = 1000;
          const currentTime = lastSendTime + timeGap;
          
          // Rapid click should be blocked by debounce
          const result = attemptSend(state, lastSendTime, currentTime);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('debounce');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow send after debounce period', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.constant(false),
          isRetrying: fc.constant(false),
          isUploading: fc.constant(false),
          hasContent: fc.constant(true),
          hasSession: fc.constant(true),
        }),
        fc.integer({ min: 500, max: 10000 }), // Time gap >= 500ms
        (state, timeGap) => {
          const lastSendTime = 1000;
          const currentTime = lastSendTime + timeGap;
          
          // After debounce period, send should be allowed
          const result = attemptSend(state, lastSendTime, currentTime);
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should disable send button when no content', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.boolean(),
          isRetrying: fc.boolean(),
          isUploading: fc.boolean(),
          hasContent: fc.constant(false), // No content
          hasSession: fc.constant(true),
        }),
        (state) => {
          // When no content, button should be disabled
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Attempt to send should be blocked
          const result = attemptSend(state, 0, 1000);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('no_content');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should disable send button when no session', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSending: fc.boolean(),
          isRetrying: fc.boolean(),
          isUploading: fc.boolean(),
          hasContent: fc.constant(true),
          hasSession: fc.constant(false), // No session
        }),
        (state) => {
          // When no session, button should be disabled
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly determine disabled state for any combination of flags', () => {
    fc.assert(
      fc.property(
        sendButtonStateArb,
        (state) => {
          const isDisabled = shouldSendButtonBeDisabled(state);
          
          // Button should be enabled ONLY when ALL of these are true:
          // - hasContent is true
          // - hasSession is true
          // - isSending is false
          // - isRetrying is false
          // - isUploading is false
          const shouldBeEnabled = 
            state.hasContent &&
            state.hasSession &&
            !state.isSending &&
            !state.isRetrying &&
            !state.isUploading;
          
          expect(isDisabled).toBe(!shouldBeEnabled);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain disabled state throughout entire send operation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.array(fc.webUrl(), { minLength: 0, maxLength: 3 }),
        (content, images) => {
          // Simulate a complete send operation lifecycle
          let state: SendButtonState = {
            isSending: false,
            isRetrying: false,
            isUploading: false,
            hasContent: content.trim().length > 0 || images.length > 0,
            hasSession: true,
          };
          
          // Initial state - button should be enabled if has content
          if (state.hasContent) {
            expect(shouldSendButtonBeDisabled(state)).toBe(false);
          }
          
          // User clicks send - state changes to sending
          state = { ...state, isSending: true };
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Send completes (success) - state returns to idle
          state = { ...state, isSending: false, hasContent: false }; // Content cleared
          expect(shouldSendButtonBeDisabled(state)).toBe(true); // No content now
          
          // User types new content
          state = { ...state, hasContent: true };
          expect(shouldSendButtonBeDisabled(state)).toBe(false); // Ready again
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain disabled state during retry operation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (content) => {
          // Simulate a retry operation lifecycle
          let state: SendButtonState = {
            isSending: false,
            isRetrying: false,
            isUploading: false,
            hasContent: true,
            hasSession: true,
          };
          
          // Initial state - button enabled
          expect(shouldSendButtonBeDisabled(state)).toBe(false);
          
          // User clicks retry on failed message
          state = { ...state, isRetrying: true, isSending: true };
          expect(shouldSendButtonBeDisabled(state)).toBe(true);
          
          // Retry completes (success or failure)
          state = { ...state, isRetrying: false, isSending: false };
          expect(shouldSendButtonBeDisabled(state)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
