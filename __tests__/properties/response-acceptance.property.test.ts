/**
 * Property Test: Response Acceptance and Progression
 * 
 * For any patient response (including brief, uncertain, or negative responses),
 * the system should accept the response and progress without re-asking.
 * 
 * Feature: intake-termination-fix, Property 2: Response Acceptance and Progression
 * Validates: Requirements 3.1, 3.2, 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectUncertaintyPhrase,
  detectNegativeResponse,
  isBriefResponse,
  UNCERTAINTY_PHRASES,
  NEGATIVE_RESPONSES,
  markTopicAnswered,
  isTopicAnswered,
} from '@/server/services/question-tracking';

describe('Property 2: Response Acceptance and Progression', () => {
  describe('Uncertainty Detection', () => {
    it('should detect all configured uncertainty phrases', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...UNCERTAINTY_PHRASES),
          (phrase) => {
            expect(detectUncertaintyPhrase(phrase)).toBe(true);
          }
        ),
        { numRuns: UNCERTAINTY_PHRASES.length }
      );
    });

    it('should detect uncertainty phrases embedded in longer messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...UNCERTAINTY_PHRASES),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (phrase, prefix, suffix) => {
            const message = `${prefix} ${phrase} ${suffix}`;
            expect(detectUncertaintyPhrase(message)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect uncertainty in confident responses', () => {
      const confidentResponses = [
        'yes definitely',
        'absolutely',
        'I am certain',
        'for sure',
        'no doubt',
        'I know exactly',
        'it started yesterday',
        'the pain is in my chest',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...confidentResponses),
          (response) => {
            expect(detectUncertaintyPhrase(response)).toBe(false);
          }
        ),
        { numRuns: confidentResponses.length }
      );
    });
  });

  describe('Negative Response Detection', () => {
    it('should detect all configured negative responses', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NEGATIVE_RESPONSES),
          (phrase) => {
            expect(detectNegativeResponse(phrase)).toBe(true);
          }
        ),
        { numRuns: NEGATIVE_RESPONSES.length }
      );
    });

    it('should detect negative responses at start of message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NEGATIVE_RESPONSES),
          fc.constantFrom(', ', '. ', ' '),
          fc.string({ minLength: 1, maxLength: 30 }),
          (negativePhrase, separator, continuation) => {
            const message = `${negativePhrase}${separator}${continuation}`;
            expect(detectNegativeResponse(message)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect negative in positive responses', () => {
      const positiveResponses = [
        'yes',
        'I have fever',
        'definitely',
        'I do have allergies',
        'yes I take medication',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...positiveResponses),
          (response) => {
            expect(detectNegativeResponse(response)).toBe(false);
          }
        ),
        { numRuns: positiveResponses.length }
      );
    });
  });

  describe('Brief Response Detection', () => {
    it('should detect responses under 10 characters as brief', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 9 }),
          (response) => {
            expect(isBriefResponse(response)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect responses of 10+ characters as brief', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 10, maxLength: 100 })
            .filter((response) => response.trim().length >= 10),
          (response) => {
            expect(isBriefResponse(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle whitespace correctly in brief detection', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.integer({ min: 0, max: 10 }),
          (content, paddingLength) => {
            const padding = ' '.repeat(paddingLength);
            const message = `${padding}${content}${padding}`;
            // After trim, content length determines if brief
            expect(isBriefResponse(message)).toBe(content.trim().length < 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Topic Tracking', () => {
    it('should mark topics as answered and prevent re-asking', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (existingTopics, newTopic) => {
            const uniqueExisting = [...new Set(existingTopics)];
            const updated = markTopicAnswered(uniqueExisting, newTopic);
            
            // New topic should be marked as answered
            expect(isTopicAnswered(updated, newTopic)).toBe(true);
            
            // All existing topics should still be answered
            for (const topic of uniqueExisting) {
              expect(isTopicAnswered(updated, topic)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not duplicate topics when marking already-answered topic', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
          (topics) => {
            const uniqueTopics = [...new Set(topics)];
            if (uniqueTopics.length === 0) return;
            
            const topicToRemark = uniqueTopics[0]!;
            const updated = markTopicAnswered(uniqueTopics, topicToRemark);
            
            // Length should not increase
            expect(updated.length).toBe(uniqueTopics.length);
            
            // Should be the same array reference (no change needed)
            expect(updated).toBe(uniqueTopics);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Response Acceptance Invariants', () => {
    it('should accept any non-empty response without throwing', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (response) => {
            // These functions should never throw for any input
            expect(() => detectUncertaintyPhrase(response)).not.toThrow();
            expect(() => detectNegativeResponse(response)).not.toThrow();
            expect(() => isBriefResponse(response)).not.toThrow();
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should handle empty and whitespace-only responses gracefully', () => {
      const edgeCases = ['', ' ', '  ', '\t', '\n', '\r\n', '   \t   '];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...edgeCases),
          (response) => {
            // Should not throw
            expect(() => detectUncertaintyPhrase(response)).not.toThrow();
            expect(() => detectNegativeResponse(response)).not.toThrow();
            expect(() => isBriefResponse(response)).not.toThrow();
            
            // Empty/whitespace should be considered brief
            expect(isBriefResponse(response)).toBe(true);
          }
        ),
        { numRuns: edgeCases.length }
      );
    });
  });
});
