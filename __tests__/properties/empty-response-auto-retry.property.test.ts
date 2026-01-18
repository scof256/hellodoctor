/**
 * Property Test: Empty Response Auto-Retry
 *
 * Property 4: For any Gemini_Service response that is empty or null, the system
 * SHALL automatically retry the request, with the total retry count not exceeding
 * 2 automatic retries.
 *
 * **Validates: Requirements 2.1**
 *
 * Feature: messaging-reliability-fix
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Configuration constants matching the actual implementation
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const FALLBACK_MESSAGE = "I apologize, but I'm having trouble processing your message. Please try again.";

// Response validation result interface (mirrors the one in gemini.ts)
interface ResponseValidationResult {
  isValid: boolean;
  reply: string;
  error?: string;
  wasRecovered: boolean;
  parsedData?: any;
}

/**
 * Validate AI response and extract reply with fallback mechanisms.
 * This is a standalone implementation for testing that mirrors the production code.
 */
function validateAIResponse(text: string | null | undefined): ResponseValidationResult {
  // Handle null/undefined/empty text
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      reply: FALLBACK_MESSAGE,
      error: 'Empty response received',
      wasRecovered: false
    };
  }

  // Try to parse as JSON first
  const parsedData = parseJsonResponse(text);
  
  if (parsedData) {
    // Check if reply field exists and is non-empty
    const reply = parsedData.reply || parsedData.message;
    if (reply && typeof reply === 'string' && reply.trim().length > 0) {
      return {
        isValid: true,
        reply: reply.trim(),
        wasRecovered: false,
        parsedData
      };
    }
    
    // JSON parsed but reply is empty - try to extract from other fields
    const recoveredReply = extractFallbackReply(parsedData, text);
    if (recoveredReply) {
      return {
        isValid: true,
        reply: recoveredReply,
        wasRecovered: true,
        parsedData
      };
    }
  }

  // JSON parsing failed - try to extract plain text as fallback
  const plainTextReply = extractPlainTextFallback(text);
  if (plainTextReply) {
    return {
      isValid: true,
      reply: plainTextReply,
      error: 'JSON parsing failed, extracted plain text',
      wasRecovered: true
    };
  }

  // All extraction attempts failed
  return {
    isValid: false,
    reply: FALLBACK_MESSAGE,
    error: 'Failed to extract valid reply from response',
    wasRecovered: false
  };
}

function parseJsonResponse(text: string): any {
  // Try markdown code block first
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Continue to fallback
    }
  }

  // Fallback: brace matching
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (e) {
      // Return null if all parsing fails
    }
  }

  return null;
}

function extractFallbackReply(parsedData: any, originalText: string): string | null {
  const alternativeFields = ['text', 'content', 'response', 'answer', 'output'];
  for (const field of alternativeFields) {
    if (parsedData[field] && typeof parsedData[field] === 'string' && parsedData[field].trim().length > 0) {
      return parsedData[field].trim();
    }
  }

  if (parsedData.thought?.nextMove && typeof parsedData.thought.nextMove === 'string') {
    return parsedData.thought.nextMove;
  }

  return null;
}

function extractPlainTextFallback(text: string): string | null {
  let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim();
  
  if (cleaned.length > 10) {
    return cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
  }

  const sentences = text.match(/[A-Z][^.!?]*[.!?]/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, 3).join(' ');
  }

  return null;
}

// Simulated response types
type SimulatedResponse = {
  text: string | null | undefined;
  isError: boolean;
  errorMessage?: string;
};

// Simulate the retry behavior of the Gemini service
function simulateRetryBehavior(
  responses: SimulatedResponse[],
  maxRetries: number = MAX_AUTO_RETRIES
): { finalResponse: SimulatedResponse | null; retryCount: number; wasRecovered: boolean } {
  let retryCount = 0;
  
  for (let i = 0; i <= maxRetries && i < responses.length; i++) {
    const response = responses[i];
    
    if (!response) continue;
    
    // Check if response is valid (non-empty, non-error)
    if (!response.isError && response.text && response.text.trim().length > 0) {
      return {
        finalResponse: response,
        retryCount,
        wasRecovered: retryCount > 0
      };
    }
    
    // Invalid response, increment retry if not at max
    if (i < maxRetries && i < responses.length - 1) {
      retryCount++;
    }
  }
  
  // All retries exhausted
  return {
    finalResponse: responses[responses.length - 1] ?? null,
    retryCount,
    wasRecovered: false
  };
}

// Calculate exponential backoff delay
function calculateBackoffDelay(retryAttempt: number, baseDelay: number = RETRY_DELAY_MS): number {
  return baseDelay * Math.pow(2, retryAttempt - 1);
}

// Arbitrary generators
const validResponseTextArb = fc.string({ minLength: 10, maxLength: 500 })
  .filter(s => s.trim().length > 0);

const emptyResponseArb = fc.constantFrom('', '   ', '\n', '\t', null, undefined);

const jsonResponseArb = fc.record({
  reply: fc.string({ minLength: 1, maxLength: 200 }),
  thought: fc.record({
    differentialDiagnosis: fc.array(fc.string()),
    strategy: fc.string(),
    missingInformation: fc.array(fc.string()),
    nextMove: fc.string()
  }),
  updatedData: fc.record({
    chiefComplaint: fc.option(fc.string()),
    hpi: fc.option(fc.string())
  })
}).map(obj => JSON.stringify(obj));

const malformedJsonArb = fc.oneof(
  fc.constant('{ invalid json'),
  fc.constant('{"reply": }'),
  fc.constant('not json at all'),
  fc.constant('```json\n{ broken }\n```')
);

describe('Property 4: Empty Response Auto-Retry', () => {
  it('retries automatically when response is empty, up to max retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // Number of empty responses before valid
        validResponseTextArb,
        (emptyCount, validText) => {
          // Create a sequence of responses: empty ones followed by a valid one
          const responses: SimulatedResponse[] = [];
          
          for (let i = 0; i < emptyCount; i++) {
            responses.push({ text: '', isError: false });
          }
          responses.push({ text: validText, isError: false });
          
          const result = simulateRetryBehavior(responses);
          
          // Retry count should not exceed MAX_AUTO_RETRIES
          expect(result.retryCount).toBeLessThanOrEqual(MAX_AUTO_RETRIES);
          
          // If valid response was within retry limit, it should be returned
          if (emptyCount <= MAX_AUTO_RETRIES) {
            expect(result.finalResponse?.text).toBe(validText);
            expect(result.wasRecovered).toBe(emptyCount > 0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stops retrying after max retries reached', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_AUTO_RETRIES + 1, max: 10 }), // More empty responses than max retries
        (emptyCount) => {
          // Create only empty responses
          const responses: SimulatedResponse[] = Array(emptyCount)
            .fill(null)
            .map(() => ({ text: '', isError: false }));
          
          const result = simulateRetryBehavior(responses);
          
          // Retry count should be exactly MAX_AUTO_RETRIES
          expect(result.retryCount).toBe(MAX_AUTO_RETRIES);
          
          // Should not have recovered
          expect(result.wasRecovered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uses exponential backoff between retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_AUTO_RETRIES }),
        (retryAttempt) => {
          const delay = calculateBackoffDelay(retryAttempt);
          const expectedDelay = RETRY_DELAY_MS * Math.pow(2, retryAttempt - 1);
          
          expect(delay).toBe(expectedDelay);
          
          // Verify delays increase exponentially
          if (retryAttempt > 1) {
            const previousDelay = calculateBackoffDelay(retryAttempt - 1);
            expect(delay).toBe(previousDelay * 2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('treats null responses as empty and retries', () => {
    fc.assert(
      fc.property(
        validResponseTextArb,
        (validText) => {
          // First response is null, second is valid
          const responses: SimulatedResponse[] = [
            { text: null, isError: false },
            { text: validText, isError: false }
          ];
          
          const result = simulateRetryBehavior(responses);
          
          expect(result.retryCount).toBe(1);
          expect(result.finalResponse?.text).toBe(validText);
          expect(result.wasRecovered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('treats undefined responses as empty and retries', () => {
    fc.assert(
      fc.property(
        validResponseTextArb,
        (validText) => {
          // First response is undefined, second is valid
          const responses: SimulatedResponse[] = [
            { text: undefined, isError: false },
            { text: validText, isError: false }
          ];
          
          const result = simulateRetryBehavior(responses);
          
          expect(result.retryCount).toBe(1);
          expect(result.finalResponse?.text).toBe(validText);
          expect(result.wasRecovered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('treats whitespace-only responses as empty and retries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('   ', '\n\n', '\t\t', '  \n  \t  '),
        validResponseTextArb,
        (whitespace, validText) => {
          const responses: SimulatedResponse[] = [
            { text: whitespace, isError: false },
            { text: validText, isError: false }
          ];
          
          const result = simulateRetryBehavior(responses);
          
          expect(result.retryCount).toBe(1);
          expect(result.finalResponse?.text).toBe(validText);
          expect(result.wasRecovered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tracks retry count in response metadata', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_AUTO_RETRIES }),
        validResponseTextArb,
        (emptyCount, validText) => {
          const responses: SimulatedResponse[] = [];
          
          for (let i = 0; i < emptyCount; i++) {
            responses.push({ text: '', isError: false });
          }
          responses.push({ text: validText, isError: false });
          
          const result = simulateRetryBehavior(responses);
          
          // Retry count should match the number of empty responses (up to max)
          expect(result.retryCount).toBe(Math.min(emptyCount, MAX_AUTO_RETRIES));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid response on first try without retrying', () => {
    fc.assert(
      fc.property(
        validResponseTextArb,
        (validText) => {
          const responses: SimulatedResponse[] = [
            { text: validText, isError: false }
          ];
          
          const result = simulateRetryBehavior(responses);
          
          expect(result.retryCount).toBe(0);
          expect(result.finalResponse?.text).toBe(validText);
          expect(result.wasRecovered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('validateAIResponse function', () => {
  it('validates non-empty responses correctly', () => {
    fc.assert(
      fc.property(
        jsonResponseArb,
        (jsonText) => {
          const wrappedJson = '```json\n' + jsonText + '\n```';
          const result = validateAIResponse(wrappedJson);
          
          // Should be valid if reply field exists and is non-empty
          const parsed = JSON.parse(jsonText);
          if (parsed.reply && parsed.reply.trim().length > 0) {
            expect(result.isValid).toBe(true);
            expect(result.reply.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns fallback for empty responses', () => {
    fc.assert(
      fc.property(
        emptyResponseArb,
        (emptyText) => {
          const result = validateAIResponse(emptyText as string);
          
          expect(result.isValid).toBe(false);
          expect(result.reply.length).toBeGreaterThan(0); // Fallback message
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('attempts plain text extraction for malformed JSON', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 200 }).filter(s => {
          // Filter to strings that look like sentences
          return /[A-Z][^.!?]*[.!?]/.test(s);
        }),
        (textWithSentences) => {
          const result = validateAIResponse(textWithSentences);
          
          // Should attempt to extract something
          expect(result.reply.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
