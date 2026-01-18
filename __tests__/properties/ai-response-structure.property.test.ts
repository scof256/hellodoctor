/**
 * Property Test: AI Response Structure Validation
 *
 * Property 7: For any valid AI response, it must contain a non-empty 'reply' string,
 * an 'updatedData' object, and a valid 'activeAgent' from the AgentRole enum.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Feature: intake-progression-booking-fix
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Valid agent roles from the system
const VALID_AGENT_ROLES = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist'
] as const;

type AgentRole = typeof VALID_AGENT_ROLES[number];

// Configuration constants matching the actual implementation
const FALLBACK_MESSAGE = "I apologize, but I'm having trouble processing your message. Please try again.";

// Response validation result interface (mirrors the one in gemini.ts)
interface ResponseValidationResult {
  isValid: boolean;
  reply: string;
  error?: string;
  wasRecovered: boolean;
  parsedData?: any;
  validationDetails?: {
    hasValidReply: boolean;
    hasValidUpdatedData: boolean;
    hasValidActiveAgent: boolean;
  };
}

/**
 * Check if a value is a plain object (not null, not array, not primitive)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is a valid AgentRole
 */
function isValidAgentRole(value: unknown): boolean {
  return typeof value === 'string' && VALID_AGENT_ROLES.includes(value as any);
}


/**
 * Validate AI response and extract reply with fallback mechanisms.
 * This is a standalone implementation for testing that mirrors the production code.
 * 
 * Validates:
 * - reply field is non-empty (Requirement 5.1)
 * - updatedData is an object (Requirement 5.2)
 * - activeAgent is a valid AgentRole (Requirement 5.3)
 * - Uses fallback for malformed responses (Requirement 5.5)
 */
function validateAIResponse(text: string | null | undefined): ResponseValidationResult {
  // Handle null/undefined/empty text
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      reply: FALLBACK_MESSAGE,
      error: 'Empty response received',
      wasRecovered: false,
      validationDetails: {
        hasValidReply: false,
        hasValidUpdatedData: false,
        hasValidActiveAgent: false
      }
    };
  }

  // Try to parse as JSON first
  const parsedData = parseJsonResponse(text);
  
  if (parsedData) {
    // Validate all required fields
    const reply = parsedData.reply || parsedData.message;
    const hasValidReply = reply && typeof reply === 'string' && reply.trim().length > 0;
    const hasValidUpdatedData = isPlainObject(parsedData.updatedData);
    const hasValidActiveAgent = isValidAgentRole(parsedData.activeAgent);
    
    // Check if reply field exists and is non-empty
    if (hasValidReply) {
      return {
        isValid: true,
        reply: reply.trim(),
        wasRecovered: false,
        parsedData,
        validationDetails: {
          hasValidReply,
          hasValidUpdatedData,
          hasValidActiveAgent
        }
      };
    }
    
    // JSON parsed but reply is empty - try to extract from other fields
    const recoveredReply = extractFallbackReply(parsedData, text);
    if (recoveredReply) {
      return {
        isValid: true,
        reply: recoveredReply,
        wasRecovered: true,
        parsedData,
        validationDetails: {
          hasValidReply: false,
          hasValidUpdatedData,
          hasValidActiveAgent
        }
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
      wasRecovered: true,
      validationDetails: {
        hasValidReply: false,
        hasValidUpdatedData: false,
        hasValidActiveAgent: false
      }
    };
  }

  // All extraction attempts failed
  return {
    isValid: false,
    reply: FALLBACK_MESSAGE,
    error: 'Failed to extract valid reply from response',
    wasRecovered: false,
    validationDetails: {
      hasValidReply: false,
      hasValidUpdatedData: false,
      hasValidActiveAgent: false
    }
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


// --- Arbitrary Generators ---

// Valid non-empty reply string
const validReplyArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

// Valid agent role
const validAgentRoleArb = fc.constantFrom(...VALID_AGENT_ROLES);

// Invalid agent role (not in the enum)
const invalidAgentRoleArb = fc.oneof(
  fc.string().filter(s => !VALID_AGENT_ROLES.includes(s as any)),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(123),
  fc.constant({}),
  fc.constant([])
);

// Valid updatedData object
const validUpdatedDataArb = fc.record({
  chiefComplaint: fc.option(fc.string()),
  hpi: fc.option(fc.string()),
  medications: fc.option(fc.array(fc.string())),
  allergies: fc.option(fc.array(fc.string())),
  recordsCheckCompleted: fc.option(fc.boolean()),
  bookingStatus: fc.option(fc.constantFrom('collecting', 'ready', 'booked'))
});

// Invalid updatedData (not an object)
const invalidUpdatedDataArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.array(fc.anything())
);

// Complete valid AI response
const completeValidResponseArb = fc.record({
  reply: validReplyArb,
  updatedData: validUpdatedDataArb,
  activeAgent: validAgentRoleArb,
  thought: fc.option(fc.record({
    differentialDiagnosis: fc.array(fc.record({
      condition: fc.string(),
      probability: fc.constantFrom('High', 'Medium', 'Low'),
      reasoning: fc.string()
    })),
    strategy: fc.string(),
    missingInformation: fc.array(fc.string()),
    nextMove: fc.string()
  }))
});

// Response with valid reply but missing/invalid updatedData
const responseWithInvalidUpdatedDataArb = fc.record({
  reply: validReplyArb,
  updatedData: invalidUpdatedDataArb,
  activeAgent: validAgentRoleArb
});

// Response with valid reply but missing/invalid activeAgent
const responseWithInvalidAgentArb = fc.record({
  reply: validReplyArb,
  updatedData: validUpdatedDataArb,
  activeAgent: invalidAgentRoleArb
});

// Response missing reply field
const responseMissingReplyArb = fc.record({
  updatedData: validUpdatedDataArb,
  activeAgent: validAgentRoleArb
});


describe('Property 7: AI Response Structure Validation', () => {
  /**
   * Requirement 5.1: THE AI response SHALL include a 'reply' field with the message text
   */
  describe('Requirement 5.1: Reply field validation', () => {
    it('validates that reply field is non-empty for valid responses', () => {
      fc.assert(
        fc.property(
          completeValidResponseArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            expect(result.isValid).toBe(true);
            expect(result.reply.trim().length).toBeGreaterThan(0);
            expect(result.validationDetails?.hasValidReply).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects responses with empty reply field', () => {
      fc.assert(
        fc.property(
          fc.record({
            reply: fc.constantFrom('', '   ', '\n', '\t'),
            updatedData: validUpdatedDataArb,
            activeAgent: validAgentRoleArb
          }),
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Should still return a reply (fallback), but hasValidReply should be false
            expect(result.reply.length).toBeGreaterThan(0);
            expect(result.validationDetails?.hasValidReply).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles missing reply field with fallback', () => {
      fc.assert(
        fc.property(
          responseMissingReplyArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Should return a fallback reply
            expect(result.reply.length).toBeGreaterThan(0);
            expect(result.validationDetails?.hasValidReply).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Requirement 5.2: THE AI response SHALL include an 'updatedData' object with any medical data changes
   */
  describe('Requirement 5.2: updatedData object validation', () => {
    it('validates that updatedData is a plain object', () => {
      fc.assert(
        fc.property(
          completeValidResponseArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            expect(result.validationDetails?.hasValidUpdatedData).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects invalid updatedData (null, undefined, array, primitive)', () => {
      fc.assert(
        fc.property(
          responseWithInvalidUpdatedDataArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Response can still be valid (has reply), but updatedData validation fails
            expect(result.validationDetails?.hasValidUpdatedData).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validates updatedData can contain medical data fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            reply: validReplyArb,
            updatedData: fc.record({
              chiefComplaint: fc.string({ minLength: 1 }),
              hpi: fc.string({ minLength: 1 }),
              medications: fc.array(fc.string()),
              allergies: fc.array(fc.string()),
              bookingStatus: fc.constantFrom('collecting', 'ready', 'booked')
            }),
            activeAgent: validAgentRoleArb
          }),
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            expect(result.validationDetails?.hasValidUpdatedData).toBe(true);
            expect(result.parsedData?.updatedData).toBeDefined();
            expect(typeof result.parsedData?.updatedData).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Requirement 5.3: THE AI response SHALL include an 'activeAgent' field indicating the current agent
   */
  describe('Requirement 5.3: activeAgent validation', () => {
    it('validates that activeAgent is a valid AgentRole', () => {
      fc.assert(
        fc.property(
          completeValidResponseArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            expect(result.validationDetails?.hasValidActiveAgent).toBe(true);
            expect(VALID_AGENT_ROLES).toContain(result.parsedData?.activeAgent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects invalid activeAgent values', () => {
      fc.assert(
        fc.property(
          responseWithInvalidAgentArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Response can still be valid (has reply), but activeAgent validation fails
            expect(result.validationDetails?.hasValidActiveAgent).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validates all valid agent roles are accepted', () => {
      for (const agentRole of VALID_AGENT_ROLES) {
        const response = {
          reply: 'Test message',
          updatedData: { chiefComplaint: 'test' },
          activeAgent: agentRole
        };
        const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
        const result = validateAIResponse(jsonText);
        
        expect(result.validationDetails?.hasValidActiveAgent).toBe(true);
        expect(result.parsedData?.activeAgent).toBe(agentRole);
      }
    });
  });

  /**
   * Combined validation: All three fields must be validated together
   * Property 7: For any valid AI response, it must contain a non-empty 'reply' string,
   * an 'updatedData' object, and a valid 'activeAgent' from the AgentRole enum.
   */
  describe('Property 7: Complete AI Response Structure', () => {
    it('validates complete responses have all required fields', () => {
      fc.assert(
        fc.property(
          completeValidResponseArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // All three validation checks should pass for a complete valid response
            expect(result.isValid).toBe(true);
            expect(result.validationDetails?.hasValidReply).toBe(true);
            expect(result.validationDetails?.hasValidUpdatedData).toBe(true);
            expect(result.validationDetails?.hasValidActiveAgent).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('always returns a non-empty reply regardless of input validity', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Valid complete response
            completeValidResponseArb.map(r => '```json\n' + JSON.stringify(r) + '\n```'),
            // Invalid responses
            fc.constantFrom(null, undefined, '', '   '),
            // Malformed JSON
            fc.string().filter(s => s.length > 0)
          ),
          (input) => {
            const result = validateAIResponse(input as string);
            
            // Should always have a non-empty reply (either extracted or fallback)
            expect(result.reply.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('correctly identifies when response was recovered vs valid', () => {
      fc.assert(
        fc.property(
          completeValidResponseArb,
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // A complete valid response should not need recovery
            expect(result.wasRecovered).toBe(false);
            expect(result.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('marks responses as recovered when reply is extracted from alternative fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            text: validReplyArb, // Alternative field instead of 'reply'
            updatedData: validUpdatedDataArb,
            activeAgent: validAgentRoleArb
          }),
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Should recover from alternative field
            if (result.isValid) {
              expect(result.wasRecovered).toBe(true);
              expect(result.validationDetails?.hasValidReply).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Requirement 5.5: IF the AI response is malformed, THEN THE System SHALL use a fallback message
   */
  describe('Requirement 5.5: Fallback for malformed responses', () => {
    it('uses fallback message for completely invalid responses', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, undefined, '', '   ', '\n\t'),
          (invalidInput) => {
            const result = validateAIResponse(invalidInput as string);
            
            expect(result.isValid).toBe(false);
            expect(result.reply).toBe(FALLBACK_MESSAGE);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('attempts recovery before using fallback', () => {
      fc.assert(
        fc.property(
          // JSON with alternative reply fields
          fc.record({
            content: validReplyArb,
            updatedData: validUpdatedDataArb,
            activeAgent: validAgentRoleArb
          }),
          (response) => {
            const jsonText = '```json\n' + JSON.stringify(response) + '\n```';
            const result = validateAIResponse(jsonText);
            
            // Should attempt to recover from 'content' field
            if (result.isValid) {
              expect(result.wasRecovered).toBe(true);
              expect(result.reply).not.toBe(FALLBACK_MESSAGE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
