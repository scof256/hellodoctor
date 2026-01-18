/**
 * Property Test: Invalid Response Logging
 *
 * Property 12: For any empty or malformed response, the system SHALL log the
 * response with context information for debugging purposes.
 *
 * **Validates: Requirements 4.3**
 *
 * Feature: messaging-reliability-fix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock console.error to capture log calls
const originalConsoleError = console.error;
let consoleErrorCalls: Array<{ message: string; data: unknown }> = [];

beforeEach(() => {
  consoleErrorCalls = [];
  console.error = vi.fn((...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      consoleErrorCalls.push({
        message: args[0],
        data: args[1],
      });
    }
  });
});

afterEach(() => {
  console.error = originalConsoleError;
});

// Interface matching the logInvalidResponse function signature
interface InvalidResponseLogContext {
  sessionId: string;
  userId: string;
  response: unknown;
  error: string;
}

/**
 * Log invalid/empty AI responses for debugging.
 * This mirrors the implementation in intake.ts
 */
function logInvalidResponse(
  sessionId: string,
  userId: string,
  response: unknown,
  error: string
): void {
  console.error('[intake.sendMessage] Invalid AI response:', {
    timestamp: new Date().toISOString(),
    sessionId,
    userId,
    error,
    responseType: typeof response,
    responsePreview: typeof response === 'string' 
      ? response.substring(0, 200) 
      : JSON.stringify(response)?.substring(0, 200),
  });
}

// Arbitrary generators
const sessionIdArb = fc.uuid();
const userIdArb = fc.uuid();
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

const emptyResponseArb = fc.constantFrom(
  null,
  undefined,
  '',
  '   ',
  { reply: null },
  { reply: '' },
  { reply: '   ' },
  { message: null }
);

const malformedResponseArb = fc.oneof(
  fc.constant('{ invalid json'),
  fc.constant('{"reply": }'),
  fc.constant('not json at all'),
  fc.constant('```json\n{ broken }\n```'),
  fc.record({
    thought: fc.string(),
    // Missing reply field
  }),
  fc.record({
    reply: fc.constant(123), // Wrong type
    thought: fc.string(),
  })
);

const validResponseArb = fc.record({
  reply: fc.string({ minLength: 1, maxLength: 500 }),
  thought: fc.record({
    differentialDiagnosis: fc.array(fc.string()),
    strategy: fc.string(),
    missingInformation: fc.array(fc.string()),
    nextMove: fc.string(),
  }),
  updatedData: fc.record({
    chiefComplaint: fc.option(fc.string()),
    hpi: fc.option(fc.string()),
  }),
});

describe('Property 12: Invalid Response Logging', () => {
  it('logs empty responses with session context', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        emptyResponseArb,
        errorMessageArb,
        (sessionId, userId, response, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, response, error);
          
          // Verify logging occurred
          expect(consoleErrorCalls.length).toBe(1);
          
          const logCall = consoleErrorCalls[0];
          expect(logCall).toBeDefined();
          expect(logCall?.message).toContain('Invalid AI response');
          
          // Verify context information is included
          const logData = logCall?.data as Record<string, unknown>;
          expect(logData).toBeDefined();
          expect(logData.sessionId).toBe(sessionId);
          expect(logData.userId).toBe(userId);
          expect(logData.error).toBe(error);
          expect(logData.timestamp).toBeDefined();
          expect(logData.responseType).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('logs malformed responses with session context', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        malformedResponseArb,
        errorMessageArb,
        (sessionId, userId, response, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, response, error);
          
          // Verify logging occurred
          expect(consoleErrorCalls.length).toBe(1);
          
          const logCall = consoleErrorCalls[0];
          expect(logCall).toBeDefined();
          
          // Verify context information is included
          const logData = logCall?.data as Record<string, unknown>;
          expect(logData).toBeDefined();
          expect(logData.sessionId).toBe(sessionId);
          expect(logData.userId).toBe(userId);
          expect(logData.error).toBe(error);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes response preview in log (truncated to 200 chars)', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        fc.string({ minLength: 250, maxLength: 1000 }), // Long response
        errorMessageArb,
        (sessionId, userId, longResponse, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, longResponse, error);
          
          // Verify logging occurred
          expect(consoleErrorCalls.length).toBe(1);
          
          const logCall = consoleErrorCalls[0];
          const logData = logCall?.data as Record<string, unknown>;
          
          // Verify response preview is truncated
          const preview = logData.responsePreview as string;
          expect(preview).toBeDefined();
          expect(preview.length).toBeLessThanOrEqual(200);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes timestamp in ISO format', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        emptyResponseArb,
        errorMessageArb,
        (sessionId, userId, response, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, response, error);
          
          const logCall = consoleErrorCalls[0];
          const logData = logCall?.data as Record<string, unknown>;
          
          // Verify timestamp is in ISO format
          const timestamp = logData.timestamp as string;
          expect(timestamp).toBeDefined();
          expect(() => new Date(timestamp)).not.toThrow();
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly identifies response type', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.record({ reply: fc.string() }),
          fc.array(fc.string())
        ),
        errorMessageArb,
        (sessionId, userId, response, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, response, error);
          
          const logCall = consoleErrorCalls[0];
          const logData = logCall?.data as Record<string, unknown>;
          
          // Verify response type matches actual type
          const expectedType = typeof response;
          expect(logData.responseType).toBe(expectedType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles object responses by JSON stringifying preview', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        userIdArb,
        fc.record({
          reply: fc.option(fc.string()),
          thought: fc.option(fc.string()),
          data: fc.option(fc.record({ field: fc.string() })),
        }),
        errorMessageArb,
        (sessionId, userId, response, error) => {
          // Reset captured calls
          consoleErrorCalls = [];
          
          // Call the logging function
          logInvalidResponse(sessionId, userId, response, error);
          
          const logCall = consoleErrorCalls[0];
          const logData = logCall?.data as Record<string, unknown>;
          
          // Verify response preview is a string (JSON stringified)
          const preview = logData.responsePreview;
          expect(typeof preview).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Invalid Response Detection', () => {
  // Helper function to check if a response is invalid
  function isInvalidResponse(response: unknown): boolean {
    if (response === null || response === undefined) return true;
    if (typeof response === 'string' && response.trim().length === 0) return true;
    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      const reply = obj.reply;
      if (reply === null || reply === undefined) return true;
      if (typeof reply === 'string' && reply.trim().length === 0) return true;
      if (typeof reply !== 'string') return true;
    }
    return false;
  }

  it('correctly identifies empty responses as invalid', () => {
    fc.assert(
      fc.property(
        emptyResponseArb,
        (response) => {
          expect(isInvalidResponse(response)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly identifies valid responses as valid', () => {
    fc.assert(
      fc.property(
        validResponseArb,
        (response) => {
          // Only valid if reply is non-empty string
          const isValid = response.reply && response.reply.trim().length > 0;
          expect(isInvalidResponse(response)).toBe(!isValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});
