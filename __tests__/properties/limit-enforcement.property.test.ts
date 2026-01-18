/**
 * Property Test: Limit Enforcement
 * 
 * For any intake session, the system should enforce message limits:
 * - Offer conclusion at 15 AI messages
 * - Force handover at 20 AI messages
 * 
 * Feature: intake-termination-fix, Property 3: Limit Enforcement
 * Validates: Requirements 1.1, 4.1, 4.2, 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  shouldOfferConclusion,
  shouldForceHandover,
  MESSAGE_LIMITS,
} from '@/server/services/question-tracking';

describe('Property 3: Limit Enforcement', () => {
  describe('Offer Conclusion Threshold (15 messages)', () => {
    it('should offer conclusion when AI message count is between 15 and 19', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MESSAGE_LIMITS.OFFER_CONCLUSION, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          (aiMessageCount) => {
            expect(shouldOfferConclusion(aiMessageCount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not offer conclusion when AI message count is below 15', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MESSAGE_LIMITS.OFFER_CONCLUSION - 1 }),
          (aiMessageCount) => {
            expect(shouldOfferConclusion(aiMessageCount)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not offer conclusion when AI message count is at or above 20', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MESSAGE_LIMITS.FORCE_HANDOVER, max: 100 }),
          (aiMessageCount) => {
            expect(shouldOfferConclusion(aiMessageCount)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Force Handover Threshold (20 messages)', () => {
    it('should force handover when AI message count is at or above 20', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MESSAGE_LIMITS.FORCE_HANDOVER, max: 100 }),
          (aiMessageCount) => {
            expect(shouldForceHandover(aiMessageCount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not force handover when AI message count is below 20', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MESSAGE_LIMITS.FORCE_HANDOVER - 1 }),
          (aiMessageCount) => {
            expect(shouldForceHandover(aiMessageCount)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Limit Constants', () => {
    it('should have OFFER_CONCLUSION less than FORCE_HANDOVER', () => {
      expect(MESSAGE_LIMITS.OFFER_CONCLUSION).toBeLessThan(MESSAGE_LIMITS.FORCE_HANDOVER);
    });

    it('should have OFFER_CONCLUSION at 15', () => {
      expect(MESSAGE_LIMITS.OFFER_CONCLUSION).toBe(15);
    });

    it('should have FORCE_HANDOVER at 20', () => {
      expect(MESSAGE_LIMITS.FORCE_HANDOVER).toBe(20);
    });
  });

  describe('Mutual Exclusivity', () => {
    it('should never have both offer conclusion and force handover true at the same time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (aiMessageCount) => {
            const offer = shouldOfferConclusion(aiMessageCount);
            const force = shouldForceHandover(aiMessageCount);
            
            // They should never both be true
            expect(offer && force).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
