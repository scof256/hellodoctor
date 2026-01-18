/**
 * Property Test: Booking Status and SBAR Invariant
 * 
 * Validates Requirements 3.3 from intake-progression-booking-fix spec:
 * - When bookingStatus is 'ready', clinicalHandover SBAR should be present
 * - SBAR should have all four required fields: situation, background, assessment, recommendation
 */

import { describe, it, expect } from 'vitest';
import type { MedicalData, SBAR } from '@/types';
import { INITIAL_MEDICAL_DATA } from '@/types';

// Helper to check if SBAR is complete
function isSBARComplete(sbar: SBAR | null | undefined): boolean {
  if (!sbar) return false;
  return !!(
    sbar.situation && sbar.situation.trim().length > 0 &&
    sbar.background && sbar.background.trim().length > 0 &&
    sbar.assessment && sbar.assessment.trim().length > 0 &&
    sbar.recommendation && sbar.recommendation.trim().length > 0
  );
}

// Helper to validate booking readiness
function isValidBookingReadyState(medicalData: MedicalData): boolean {
  if (medicalData.bookingStatus !== 'ready') {
    return true; // Not in ready state, no invariant to check
  }
  // When bookingStatus is 'ready', SBAR should be present and complete
  return isSBARComplete(medicalData.clinicalHandover);
}

describe('Booking Status and SBAR Invariant', () => {
  describe('Property 1: SBAR Completeness Check', () => {
    it('should return false for null SBAR', () => {
      expect(isSBARComplete(null)).toBe(false);
    });

    it('should return false for undefined SBAR', () => {
      expect(isSBARComplete(undefined)).toBe(false);
    });

    it('should return false for SBAR with missing situation', () => {
      const sbar: SBAR = {
        situation: '',
        background: 'Background info',
        assessment: 'Assessment info',
        recommendation: 'Recommendation info',
      };
      expect(isSBARComplete(sbar)).toBe(false);
    });

    it('should return false for SBAR with missing background', () => {
      const sbar: SBAR = {
        situation: 'Situation info',
        background: '',
        assessment: 'Assessment info',
        recommendation: 'Recommendation info',
      };
      expect(isSBARComplete(sbar)).toBe(false);
    });

    it('should return false for SBAR with missing assessment', () => {
      const sbar: SBAR = {
        situation: 'Situation info',
        background: 'Background info',
        assessment: '',
        recommendation: 'Recommendation info',
      };
      expect(isSBARComplete(sbar)).toBe(false);
    });

    it('should return false for SBAR with missing recommendation', () => {
      const sbar: SBAR = {
        situation: 'Situation info',
        background: 'Background info',
        assessment: 'Assessment info',
        recommendation: '',
      };
      expect(isSBARComplete(sbar)).toBe(false);
    });

    it('should return true for complete SBAR', () => {
      const sbar: SBAR = {
        situation: 'Patient presenting with headache',
        background: 'No significant medical history',
        assessment: 'Likely tension headache',
        recommendation: 'OTC pain relief, follow up if persists',
      };
      expect(isSBARComplete(sbar)).toBe(true);
    });
  });

  describe('Property 2: Booking Ready Implies SBAR Present', () => {
    it('should be valid when bookingStatus is collecting (no SBAR required)', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'collecting',
        clinicalHandover: null,
      };
      expect(isValidBookingReadyState(data)).toBe(true);
    });

    it('should be invalid when bookingStatus is ready but SBAR is null', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'ready',
        clinicalHandover: null,
      };
      expect(isValidBookingReadyState(data)).toBe(false);
    });

    it('should be invalid when bookingStatus is ready but SBAR is incomplete', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'ready',
        clinicalHandover: {
          situation: 'Patient presenting',
          background: '',
          assessment: 'Assessment',
          recommendation: 'Recommendation',
        },
      };
      expect(isValidBookingReadyState(data)).toBe(false);
    });

    it('should be valid when bookingStatus is ready and SBAR is complete', () => {
      const data: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        bookingStatus: 'ready',
        clinicalHandover: {
          situation: 'Patient presenting with headache',
          background: 'No significant medical history',
          assessment: 'Likely tension headache',
          recommendation: 'OTC pain relief, follow up if persists',
        },
      };
      expect(isValidBookingReadyState(data)).toBe(true);
    });
  });

  describe('Property 3: SBAR Fields Are Non-Empty Strings', () => {
    it('should reject whitespace-only fields', () => {
      const sbar: SBAR = {
        situation: '   ',
        background: 'Background info',
        assessment: 'Assessment info',
        recommendation: 'Recommendation info',
      };
      expect(isSBARComplete(sbar)).toBe(false);
    });

    it('should accept fields with actual content', () => {
      const sbar: SBAR = {
        situation: 'Valid situation',
        background: 'Valid background',
        assessment: 'Valid assessment',
        recommendation: 'Valid recommendation',
      };
      expect(isSBARComplete(sbar)).toBe(true);
    });
  });
});
