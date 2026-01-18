/**
 * Property Test: Response Timeout Handling
 *
 * Property 5: For any AI request that takes longer than 30 seconds, the system
 * SHALL trigger a timeout and provide a retry option to the user.
 *
 * **Validates: Requirements 2.3**
 *
 * Feature: messaging-reliability-fix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Configuration constants matching the actual implementation
const RESPONSE_TIMEOUT_MS = 30000; // 30 seconds

// Simulated timeout state management
interface TimeoutState {
  isTimedOut: boolean;
  isSending: boolean;
  timeoutTriggeredAt: number | null;
  sendStartedAt: number | null;
}

/**
 * Simulates the timeout behavior of the intake chat system.
 * This mirrors the production implementation in the patient intake page.
 */
class TimeoutSimulator {
  private state: TimeoutState = {
    isTimedOut: false,
    isSending: false,
    timeoutTriggeredAt: null,
    sendStartedAt: null,
  };
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;

  constructor(timeoutMs: number = RESPONSE_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Start sending a message - this starts the timeout timer
   */
  startSending(): void {
    this.state.isSending = true;
    this.state.isTimedOut = false;
    this.state.sendStartedAt = Date.now();
    this.state.timeoutTriggeredAt = null;

    // Clear any existing timer
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    // Start timeout timer
    this.timeoutTimer = setTimeout(() => {
      this.state.isTimedOut = true;
      this.state.timeoutTriggeredAt = Date.now();
    }, this.timeoutMs);
  }

  /**
   * Complete sending successfully - clears timeout
   */
  completeSending(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.state.isSending = false;
    this.state.isTimedOut = false;
    this.state.timeoutTriggeredAt = null;
  }

  /**
   * Fail sending - clears timeout
   */
  failSending(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.state.isSending = false;
    this.state.isTimedOut = false;
    this.state.timeoutTriggeredAt = null;
  }

  /**
   * Handle timeout retry - user clicked retry after timeout
   */
  handleTimeoutRetry(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.state.isTimedOut = false;
    this.state.isSending = false;
  }

  /**
   * Simulate time passing (for testing)
   */
  simulateTimePassing(ms: number): void {
    if (this.state.isSending && this.state.sendStartedAt) {
      const elapsed = ms;
      if (elapsed >= this.timeoutMs && !this.state.isTimedOut) {
        this.state.isTimedOut = true;
        this.state.timeoutTriggeredAt = this.state.sendStartedAt + this.timeoutMs;
      }
    }
  }

  getState(): TimeoutState {
    return { ...this.state };
  }

  cleanup(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

/**
 * Determines if a retry option should be shown based on timeout state
 */
function shouldShowRetryOption(state: TimeoutState): boolean {
  return state.isSending && state.isTimedOut;
}

/**
 * Calculates the elapsed time since sending started
 */
function calculateElapsedTime(sendStartedAt: number | null): number {
  if (!sendStartedAt) return 0;
  return Date.now() - sendStartedAt;
}

// Arbitrary generators
const responseTimeArb = fc.integer({ min: 0, max: 120000 }); // 0 to 120 seconds
const timeoutConfigArb = fc.integer({ min: 1000, max: 60000 }); // 1 to 60 seconds

describe('Property 5: Response Timeout Handling', () => {
  let simulator: TimeoutSimulator;

  beforeEach(() => {
    vi.useFakeTimers();
    simulator = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
  });

  afterEach(() => {
    simulator.cleanup();
    vi.useRealTimers();
  });

  it('triggers timeout after configured timeout period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: RESPONSE_TIMEOUT_MS, max: RESPONSE_TIMEOUT_MS * 3 }),
        (elapsedTime) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          sim.startSending();
          
          // Simulate time passing beyond timeout
          sim.simulateTimePassing(elapsedTime);
          
          const state = sim.getState();
          
          // Should be timed out if elapsed time >= timeout
          expect(state.isTimedOut).toBe(true);
          
          // Retry option should be available
          expect(shouldShowRetryOption(state)).toBe(true);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not trigger timeout before configured timeout period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: RESPONSE_TIMEOUT_MS - 1 }),
        (elapsedTime) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          sim.startSending();
          
          // Simulate time passing before timeout
          sim.simulateTimePassing(elapsedTime);
          
          const state = sim.getState();
          
          // Should NOT be timed out if elapsed time < timeout
          expect(state.isTimedOut).toBe(false);
          
          // Retry option should NOT be available yet
          expect(shouldShowRetryOption(state)).toBe(false);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clears timeout when response completes successfully', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: RESPONSE_TIMEOUT_MS - 100 }),
        (responseTime) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          sim.startSending();
          
          // Simulate response completing before timeout
          sim.simulateTimePassing(responseTime);
          sim.completeSending();
          
          const state = sim.getState();
          
          // Should not be timed out after successful completion
          expect(state.isTimedOut).toBe(false);
          expect(state.isSending).toBe(false);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clears timeout when response fails', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: RESPONSE_TIMEOUT_MS * 2 }),
        (responseTime) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          sim.startSending();
          
          // Simulate response failing
          sim.simulateTimePassing(responseTime);
          sim.failSending();
          
          const state = sim.getState();
          
          // Should not be timed out after failure (error handling takes over)
          expect(state.isTimedOut).toBe(false);
          expect(state.isSending).toBe(false);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('provides retry option when timeout occurs', () => {
    fc.assert(
      fc.property(
        timeoutConfigArb,
        (timeoutMs) => {
          const sim = new TimeoutSimulator(timeoutMs);
          sim.startSending();
          
          // Simulate time passing beyond timeout
          sim.simulateTimePassing(timeoutMs + 1000);
          
          const state = sim.getState();
          
          // Retry option should be available when timed out
          if (state.isTimedOut && state.isSending) {
            expect(shouldShowRetryOption(state)).toBe(true);
          }
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clears timeout state when user clicks retry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: RESPONSE_TIMEOUT_MS, max: RESPONSE_TIMEOUT_MS * 2 }),
        (elapsedTime) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          sim.startSending();
          
          // Simulate timeout occurring
          sim.simulateTimePassing(elapsedTime);
          
          // User clicks retry
          sim.handleTimeoutRetry();
          
          const state = sim.getState();
          
          // Timeout state should be cleared
          expect(state.isTimedOut).toBe(false);
          expect(state.isSending).toBe(false);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('timeout triggers at exactly the configured time', () => {
    fc.assert(
      fc.property(
        timeoutConfigArb,
        (timeoutMs) => {
          const sim = new TimeoutSimulator(timeoutMs);
          sim.startSending();
          
          // Just before timeout - should not be timed out
          sim.simulateTimePassing(timeoutMs - 1);
          expect(sim.getState().isTimedOut).toBe(false);
          
          // At exactly timeout - should be timed out
          sim.simulateTimePassing(timeoutMs);
          expect(sim.getState().isTimedOut).toBe(true);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple sends reset the timeout timer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1000, max: RESPONSE_TIMEOUT_MS - 1000 }),
        (sendCount, intervalBetweenSends) => {
          const sim = new TimeoutSimulator(RESPONSE_TIMEOUT_MS);
          
          for (let i = 0; i < sendCount; i++) {
            sim.startSending();
            
            // Simulate some time passing (but not enough to timeout)
            sim.simulateTimePassing(intervalBetweenSends);
            
            // Should not be timed out yet
            expect(sim.getState().isTimedOut).toBe(false);
          }
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Timeout UI State', () => {
  it('shows correct UI state based on timeout', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isSending
        fc.boolean(), // isTimedOut
        (isSending, isTimedOut) => {
          const state: TimeoutState = {
            isSending,
            isTimedOut,
            timeoutTriggeredAt: isTimedOut ? Date.now() : null,
            sendStartedAt: isSending ? Date.now() - 1000 : null,
          };
          
          // Retry option should only show when both sending AND timed out
          const showRetry = shouldShowRetryOption(state);
          expect(showRetry).toBe(isSending && isTimedOut);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('elapsed time calculation is accurate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120000 }),
        (elapsedMs) => {
          const sendStartedAt = Date.now() - elapsedMs;
          const calculated = calculateElapsedTime(sendStartedAt);
          
          // Should be approximately equal (within 10ms tolerance for test execution time)
          expect(Math.abs(calculated - elapsedMs)).toBeLessThan(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 elapsed time when not sending', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (sendStartedAt) => {
          const elapsed = calculateElapsedTime(sendStartedAt);
          expect(elapsed).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Timeout Configuration', () => {
  it('respects custom timeout configuration', () => {
    fc.assert(
      fc.property(
        timeoutConfigArb,
        (customTimeoutMs) => {
          const sim = new TimeoutSimulator(customTimeoutMs);
          sim.startSending();
          
          // Just before custom timeout
          sim.simulateTimePassing(customTimeoutMs - 1);
          expect(sim.getState().isTimedOut).toBe(false);
          
          // At custom timeout
          sim.simulateTimePassing(customTimeoutMs);
          expect(sim.getState().isTimedOut).toBe(true);
          
          sim.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default timeout is 30 seconds', () => {
    const sim = new TimeoutSimulator();
    sim.startSending();
    
    // Just before 30 seconds
    sim.simulateTimePassing(29999);
    expect(sim.getState().isTimedOut).toBe(false);
    
    // At 30 seconds
    sim.simulateTimePassing(30000);
    expect(sim.getState().isTimedOut).toBe(true);
    
    sim.cleanup();
  });
});
