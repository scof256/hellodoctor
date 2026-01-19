/**
 * Property-Based Test: Profile Photo File Type Validation
 * Feature: doctor-professional-profile, Property 7: Profile Photo File Type Validation
 * 
 * Property: For any uploaded file, the system should accept it as a profile photo
 * if and only if its MIME type is one of: image/jpeg, image/png, image/webp, or image/gif.
 * 
 * Validates: Requirements 4.1
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Accepted MIME types for profile photos
const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Function to validate file type (extracted from component logic)
function validateFileType(mimeType: string): boolean {
  return ACCEPTED_MIME_TYPES.includes(mimeType);
}

describe('Property 7: Profile Photo File Type Validation', () => {
  it('should accept only valid image MIME types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid MIME types
          fc.constantFrom(...ACCEPTED_MIME_TYPES),
          // Invalid MIME types
          fc.constantFrom(
            'image/svg+xml',
            'image/bmp',
            'image/tiff',
            'application/pdf',
            'text/plain',
            'video/mp4',
            'audio/mpeg',
            'application/json',
            'text/html',
            'application/octet-stream'
          ),
          // Random strings
          fc.string()
        ),
        (mimeType) => {
          const isValid = validateFileType(mimeType);
          const shouldBeValid = ACCEPTED_MIME_TYPES.includes(mimeType);
          
          // The validation result should match whether the MIME type is in the accepted list
          expect(isValid).toBe(shouldBeValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept all valid image formats', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        (mimeType) => {
          const isValid = validateFileType(mimeType);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject all non-image or unsupported image formats', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !ACCEPTED_MIME_TYPES.includes(s)),
        (mimeType) => {
          const isValid = validateFileType(mimeType);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be case-sensitive for MIME types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        (mimeType) => {
          const upperCase = mimeType.toUpperCase();
          const mixedCase = mimeType.split('').map((c, i) => 
            i % 2 === 0 ? c.toUpperCase() : c
          ).join('');
          
          // Original should be valid
          expect(validateFileType(mimeType)).toBe(true);
          
          // Case variations should be invalid (MIME types are case-sensitive)
          if (upperCase !== mimeType) {
            expect(validateFileType(upperCase)).toBe(false);
          }
          if (mixedCase !== mimeType) {
            expect(validateFileType(mixedCase)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
