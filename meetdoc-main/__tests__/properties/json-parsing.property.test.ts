/**
 * Feature: nextjs-fullstack-conversion, Property 2: JSON Response Parsing Round-Trip
 * 
 * For any valid AgentResponse object, serializing it to JSON (as the AI model would return)
 * and then parsing it with the parser SHALL produce an equivalent object with thought, reply,
 * and updatedData fields extracted correctly.
 * 
 * Validates: Requirements 11.1, 11.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseJsonResponse, extractResponseFields } from '@/app/lib/parse-utils';
import { VALID_AGENT_ROLES } from '@/app/types';

// Arbitrary for DoctorThought
const doctorThoughtArb = fc.record({
  differentialDiagnosis: fc.array(
    fc.record({
      condition: fc.string({ minLength: 1 }),
      probability: fc.constantFrom('High', 'Medium', 'Low'),
      reasoning: fc.string()
    }),
    { maxLength: 5 }
  ),
  missingInformation: fc.array(fc.string(), { maxLength: 5 }),
  strategy: fc.string(),
  nextMove: fc.string()
});

// Arbitrary for partial MedicalData update
const medicalDataUpdateArb = fc.record({
  chiefComplaint: fc.option(fc.string(), { nil: undefined }),
  hpi: fc.option(fc.string(), { nil: undefined }),
  medications: fc.option(fc.array(fc.string(), { maxLength: 5 }), { nil: undefined }),
  allergies: fc.option(fc.array(fc.string(), { maxLength: 5 }), { nil: undefined })
});

// Arbitrary for AgentResponse
const agentResponseArb = fc.record({
  thought: doctorThoughtArb,
  reply: fc.string({ minLength: 1 }),
  updatedData: medicalDataUpdateArb,
  activeAgent: fc.constantFrom(...VALID_AGENT_ROLES)
});

describe('Property 2: JSON Response Parsing Round-Trip', () => {
  it('parsing JSON wrapped in markdown code blocks extracts the object correctly', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const wrappedInMarkdown = '```json\n' + jsonString + '\n```';
        
        const parsed = parseJsonResponse(wrappedInMarkdown);
        
        expect(parsed).not.toBeNull();
        expect(parsed.thought).toEqual(response.thought);
        expect(parsed.reply).toEqual(response.reply);
        expect(parsed.updatedData).toEqual(response.updatedData);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('parsing raw JSON (brace matching fallback) extracts the object correctly', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        const jsonString = JSON.stringify(response);
        const withSurroundingText = 'Here is my response: ' + jsonString + ' Hope that helps!';
        
        const parsed = parseJsonResponse(withSurroundingText);
        
        expect(parsed).not.toBeNull();
        expect(parsed.thought).toEqual(response.thought);
        expect(parsed.reply).toEqual(response.reply);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('extractResponseFields correctly extracts thought, reply, and updatedData', () => {
    fc.assert(
      fc.property(agentResponseArb, (response) => {
        const extracted = extractResponseFields(response);
        
        expect(extracted.thought).toEqual(response.thought);
        expect(extracted.reply).toEqual(response.reply);
        expect(extracted.updatedData).toEqual(response.updatedData);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('returns null for invalid JSON', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return !s.includes('{') || !s.includes('}');
          }
        }),
        (invalidJson) => {
          const parsed = parseJsonResponse(invalidJson);
          expect(parsed).toBeNull();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
