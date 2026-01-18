/**
 * Feature: a2a-protocol-progression-fix, Property 6: Response Processing Resilience
 * 
 * For any AI response format (valid JSON, malformed JSON, plain text, empty), 
 * the system should extract usable information or provide appropriate fallbacks without crashing
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';

// Mock the environment before importing the service
beforeAll(() => {
  vi.mock('@/env', () => ({
    env: {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-2.0-flash'
    }
  }));
});

import { GeminiService } from '@/server/services/gemini';

// Create a test instance to access parsing methods
const geminiService = new GeminiService();

// Access the private parseJsonResponse method for testing
const parseJsonResponse = (geminiService as any).parseJsonResponse.bind(geminiService);

describe('Property 6: Response Processing Resilience', () => {
  it('valid JSON responses are parsed correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          thought: fc.record({
            differentialDiagnosis: fc.array(fc.record({
              condition: fc.string(),
              probability: fc.constantFrom('High', 'Medium', 'Low'),
              reasoning: fc.string()
            })),
            strategy: fc.string(),
            missingInformation: fc.array(fc.string()),
            nextMove: fc.string()
          }),
          reply: fc.string({ minLength: 1 }),
          updatedData: fc.record({
            chiefComplaint: fc.option(fc.string(), { nil: null }),
            hpi: fc.option(fc.string(), { nil: null })
          })
        }),
        (validData) => {
          const jsonString = JSON.stringify(validData);
          const wrappedJson = `\`\`\`json\n${jsonString}\n\`\`\``;
          
          const result = parseJsonResponse(wrappedJson);
          
          expect(result).not.toBeNull();
          expect(result.reply).toBe(validData.reply);
          expect(result.thought).toEqual(validData.thought);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('malformed JSON responses do not crash the system', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('{ invalid json'),
          fc.constant('```json\n{ "reply": "test", "missing": }\n```'),
          fc.constant('```json\n{ "reply": "test" "missing comma" }\n```'),
          fc.constant('```json\n[ "array instead of object" ]\n```'),
          fc.constant('```json\n"just a string"\n```'),
          fc.constant('```json\n123\n```'),
          fc.constant('```json\nnull\n```')
        ),
        (malformedJson) => {
          // This should not throw an error
          expect(() => {
            const result = parseJsonResponse(malformedJson);
            // Result can be null, object, string, number, array, or boolean for various JSON types
            expect(result === null || typeof result === 'object' || typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean').toBe(true);
          }).not.toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('plain text responses are handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }).filter(s => !s.includes('{') && !s.includes('}')), // Exclude strings that might contain JSON
        (plainText) => {
          const result = parseJsonResponse(plainText);
          
          // Plain text without JSON should return null from JSON parser
          expect(result).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty responses are handled without crashing', () => {
    const emptyInputs = ['', '   ', '\n\n', '```json\n\n```', '```\n\n```'];
    
    emptyInputs.forEach(emptyInput => {
      expect(() => {
        const result = parseJsonResponse(emptyInput);
        expect(result === null).toBe(true);
      }).not.toThrow();
    });
  });

  it('mixed content responses extract JSON when present', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.record({
          reply: fc.string({ minLength: 1 }),
          updatedData: fc.record({
            chiefComplaint: fc.option(fc.string(), { nil: null })
          })
        }),
        fc.string(),
        (prefixText, validData, suffixText) => {
          const jsonString = JSON.stringify(validData);
          const mixedContent = `${prefixText}\n\`\`\`json\n${jsonString}\n\`\`\`\n${suffixText}`;
          
          const result = parseJsonResponse(mixedContent);
          
          expect(result).not.toBeNull();
          expect(result.reply).toBe(validData.reply);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('responses with partial JSON structure are handled', () => {
    const partialJsonResponses = [
      '```json\n{ "reply": "test" }\n```', // Missing other fields
      '```json\n{ "updatedData": { "chiefComplaint": "headache" } }\n```', // Missing reply
      '```json\n{ "thought": { "nextMove": "ask more" } }\n```', // Partial thought
    ];

    partialJsonResponses.forEach(partialJson => {
      expect(() => {
        const result = parseJsonResponse(partialJson);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('object');
      }).not.toThrow();
    });
  });

  it('JSON parsing with brace matching fallback works', () => {
    fc.assert(
      fc.property(
        fc.record({
          reply: fc.string({ minLength: 1 }),
          updatedData: fc.record({
            chiefComplaint: fc.option(fc.string(), { nil: null })
          })
        }),
        (validData) => {
          const jsonString = JSON.stringify(validData);
          // Test without markdown code blocks (should use brace matching)
          const textWithJson = `Some text before ${jsonString} and some text after`;
          
          const result = parseJsonResponse(textWithJson);
          
          expect(result).not.toBeNull();
          expect(result.reply).toBe(validData.reply);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('system never crashes on any response format', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(), // Any string
          fc.constant(''), // Empty string
          fc.unicodeString(), // Unicode content
          fc.constant('```json\n{"reply": "test", "invalid": }\n```'), // Malformed JSON
          fc.constant('Just plain text with no structure'),
          fc.constant('{ "no": "markdown", "wrapper": true }'), // JSON without wrapper
        ),
        (anyInput) => {
          // None of these operations should throw
          expect(() => {
            const jsonResult = parseJsonResponse(anyInput as string);
            
            // Results can be any valid JSON type or null
            expect(jsonResult === null || typeof jsonResult === 'object' || typeof jsonResult === 'string' || typeof jsonResult === 'number' || typeof jsonResult === 'boolean').toBe(true);
          }).not.toThrow();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});