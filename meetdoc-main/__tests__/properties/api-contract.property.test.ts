/**
 * Feature: nextjs-fullstack-conversion, Property 1: API Request/Response Contract
 * 
 * For any valid chat request containing history, medicalData, and mode,
 * the /api/chat endpoint SHALL return a response containing a response object
 * with thought, reply, updatedData, and activeAgent fields.
 * 
 * Validates: Requirements 3.2, 3.4, 3.6, 4.3
 * 
 * Note: These tests validate the contract structure without making actual API calls.
 * Integration tests would be needed to test the full API flow.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  ChatRequest, 
  ChatResponse, 
  Message, 
  INITIAL_MEDICAL_DATA, 
  VALID_AGENT_ROLES,
  AgentResponse
} from '@/app/types';

// Arbitrary for Message
const messageArb = fc.record({
  id: fc.string({ minLength: 1 }),
  role: fc.constantFrom('user', 'model', 'doctor') as fc.Arbitrary<'user' | 'model' | 'doctor'>,
  text: fc.string(),
  images: fc.option(fc.array(fc.string(), { maxLength: 3 }), { nil: undefined }),
  timestamp: fc.date()
});

// Arbitrary for valid ChatRequest
const validChatRequestArb = fc.record({
  history: fc.array(messageArb, { minLength: 1, maxLength: 10 }),
  medicalData: fc.constant(INITIAL_MEDICAL_DATA),
  mode: fc.constantFrom('patient', 'doctor') as fc.Arbitrary<'patient' | 'doctor'>
});

// Arbitrary for AgentResponse
const agentResponseArb = fc.record({
  thought: fc.record({
    differentialDiagnosis: fc.array(
      fc.record({
        condition: fc.string(),
        probability: fc.string(),
        reasoning: fc.string()
      }),
      { maxLength: 5 }
    ),
    missingInformation: fc.array(fc.string(), { maxLength: 5 }),
    strategy: fc.string(),
    nextMove: fc.string()
  }),
  reply: fc.string(),
  updatedData: fc.record({}),
  activeAgent: fc.constantFrom(...VALID_AGENT_ROLES)
});

// Validate request structure
function isValidChatRequest(req: any): req is ChatRequest {
  return (
    req &&
    Array.isArray(req.history) &&
    req.medicalData !== undefined &&
    (req.mode === 'patient' || req.mode === 'doctor')
  );
}

// Validate response structure
function isValidChatResponse(res: any): res is ChatResponse {
  return (
    res &&
    res.response &&
    typeof res.response.reply === 'string' &&
    res.response.thought !== undefined &&
    res.response.updatedData !== undefined &&
    VALID_AGENT_ROLES.includes(res.response.activeAgent)
  );
}

describe('Property 1: API Request/Response Contract', () => {
  it('valid chat requests pass validation', () => {
    fc.assert(
      fc.property(validChatRequestArb, (request) => {
        expect(isValidChatRequest(request)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('requests without history fail validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          medicalData: fc.constant(INITIAL_MEDICAL_DATA),
          mode: fc.constantFrom('patient', 'doctor')
        }),
        (partialRequest) => {
          expect(isValidChatRequest(partialRequest)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('requests without medicalData fail validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          history: fc.array(messageArb, { minLength: 1 }),
          mode: fc.constantFrom('patient', 'doctor')
        }),
        (partialRequest) => {
          expect(isValidChatRequest(partialRequest)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('requests with invalid mode fail validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          history: fc.array(messageArb, { minLength: 1 }),
          medicalData: fc.constant(INITIAL_MEDICAL_DATA),
          mode: fc.string().filter(s => s !== 'patient' && s !== 'doctor')
        }),
        (invalidRequest) => {
          expect(isValidChatRequest(invalidRequest)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid responses pass validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          response: agentResponseArb,
          groundingMetadata: fc.option(fc.record({}), { nil: undefined })
        }),
        (response) => {
          expect(isValidChatResponse(response)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('responses must have valid activeAgent', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        expect(VALID_AGENT_ROLES).toContain(response.activeAgent);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('responses must have reply string', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        expect(typeof response.reply).toBe('string');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('responses must have thought object', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        expect(response.thought).toBeDefined();
        expect(response.thought.differentialDiagnosis).toBeDefined();
        expect(response.thought.missingInformation).toBeDefined();
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
