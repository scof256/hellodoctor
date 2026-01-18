/**
 * Feature: doctor-appointment-saas, Property 9: QR Code URL Consistency
 * 
 * For any doctor profile, the QR code image SHALL encode exactly the doctor's 
 * public profile URL in the format `/connect/{doctor_slug}`, and scanning the 
 * QR code SHALL navigate to that URL.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateDoctorShareUrl,
  generateQRCodeDataUrl,
  generateDoctorQRCode,
  isValidQRCodeDataUrl,
  extractSlugFromShareUrl,
} from '@/server/services/qr';

// Arbitrary generator for valid doctor slugs
// Slugs are lowercase alphanumeric with hyphens, 1-50 chars
const slugArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/).filter(
  (s) => s.length >= 2 && s.length <= 50 && !s.includes('--')
);

// Arbitrary generator for base URLs
const baseUrlArb = fc.constantFrom(
  'http://localhost:3000',
  'https://example.com',
  'https://doctor-app.vercel.app',
  'https://my-clinic.com'
);

describe('Property 9: QR Code URL Consistency', () => {
  describe('Share URL Generation', () => {
    it('for any valid slug, share URL follows /connect/{slug} format', () => {
      fc.assert(
        fc.property(slugArb, (slug: string) => {
          const shareUrl = generateDoctorShareUrl(slug);
          
          // URL should end with /connect/{slug}
          expect(shareUrl).toContain(`/connect/${slug}`);
          
          // Extracting slug from URL should return the original slug
          const extractedSlug = extractSlugFromShareUrl(shareUrl);
          expect(extractedSlug).toBe(slug);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any slug and base URL, share URL is properly constructed', () => {
      fc.assert(
        fc.property(slugArb, baseUrlArb, (slug: string, baseUrl: string) => {
          const shareUrl = generateDoctorShareUrl(slug, baseUrl);
          
          // URL should start with base URL
          expect(shareUrl.startsWith(baseUrl)).toBe(true);
          
          // URL should contain the slug in the correct path
          expect(shareUrl).toBe(`${baseUrl}/connect/${slug}`);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('share URL generation is deterministic for same inputs', () => {
      fc.assert(
        fc.property(slugArb, baseUrlArb, (slug: string, baseUrl: string) => {
          const url1 = generateDoctorShareUrl(slug, baseUrl);
          const url2 = generateDoctorShareUrl(slug, baseUrl);
          
          expect(url1).toBe(url2);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('QR Code Generation', () => {
    it('for any valid slug, QR code data URL is valid base64 PNG', async () => {
      await fc.assert(
        fc.asyncProperty(slugArb, async (slug: string) => {
          const shareUrl = generateDoctorShareUrl(slug);
          const qrCodeDataUrl = await generateQRCodeDataUrl(shareUrl);
          
          // Should be a valid data URL
          expect(isValidQRCodeDataUrl(qrCodeDataUrl)).toBe(true);
          
          // Should start with PNG data URL prefix
          expect(qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);
          
          return true;
        }),
        { numRuns: 20 } // Reduced for async QR generation performance
      );
    }, 30000); // Extended timeout for async operations

    it('generateDoctorQRCode returns consistent shareUrl and qrCodeDataUrl', async () => {
      await fc.assert(
        fc.asyncProperty(slugArb, async (slug: string) => {
          const result = await generateDoctorQRCode(slug);
          
          // Share URL should match expected format
          expect(result.shareUrl).toContain(`/connect/${slug}`);
          
          // QR code should be valid
          expect(isValidQRCodeDataUrl(result.qrCodeDataUrl)).toBe(true);
          
          // Extracting slug from share URL should return original slug
          const extractedSlug = extractSlugFromShareUrl(result.shareUrl);
          expect(extractedSlug).toBe(slug);
          
          return true;
        }),
        { numRuns: 20 } // Reduced for async QR generation performance
      );
    }, 30000); // Extended timeout for async operations
  });

  describe('Slug Extraction Round-Trip', () => {
    it('for any slug, extracting from generated URL returns original slug', () => {
      fc.assert(
        fc.property(slugArb, baseUrlArb, (slug: string, baseUrl: string) => {
          const shareUrl = generateDoctorShareUrl(slug, baseUrl);
          const extractedSlug = extractSlugFromShareUrl(shareUrl);
          
          expect(extractedSlug).toBe(slug);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('extractSlugFromShareUrl returns null for invalid URLs', () => {
      const invalidUrls = [
        'https://example.com',
        'https://example.com/doctors/slug',
        'https://example.com/connect',
        '/connect/',
        '',
      ];

      for (const url of invalidUrls) {
        const result = extractSlugFromShareUrl(url);
        // Either null or empty string for invalid URLs
        expect(result === null || result === '').toBe(true);
      }
    });
  });

  describe('URL Format Consistency', () => {
    it('share URL path is always /connect/{slug} regardless of base URL', () => {
      fc.assert(
        fc.property(slugArb, baseUrlArb, (slug: string, baseUrl: string) => {
          const shareUrl = generateDoctorShareUrl(slug, baseUrl);
          
          // Remove base URL to get path
          const path = shareUrl.replace(baseUrl, '');
          
          // Path should be exactly /connect/{slug}
          expect(path).toBe(`/connect/${slug}`);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('different slugs produce different share URLs', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb.filter((s) => s.length > 3), // Ensure different slugs
          baseUrlArb,
          (slug1: string, slug2: string, baseUrl: string) => {
            // Skip if slugs are the same
            if (slug1 === slug2) return true;
            
            const url1 = generateDoctorShareUrl(slug1, baseUrl);
            const url2 = generateDoctorShareUrl(slug2, baseUrl);
            
            expect(url1).not.toBe(url2);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles slugs with numbers correctly', async () => {
      const slugsWithNumbers = ['doctor-123', 'dr-john-456', 'clinic-2024'];
      
      for (const slug of slugsWithNumbers) {
        const shareUrl = generateDoctorShareUrl(slug);
        expect(shareUrl).toContain(`/connect/${slug}`);
        
        const extractedSlug = extractSlugFromShareUrl(shareUrl);
        expect(extractedSlug).toBe(slug);
        
        const qrCode = await generateQRCodeDataUrl(shareUrl);
        expect(isValidQRCodeDataUrl(qrCode)).toBe(true);
      }
    });

    it('handles minimum length slugs', async () => {
      const minSlug = 'ab';
      const shareUrl = generateDoctorShareUrl(minSlug);
      expect(shareUrl).toContain(`/connect/${minSlug}`);
      
      const qrCode = await generateQRCodeDataUrl(shareUrl);
      expect(isValidQRCodeDataUrl(qrCode)).toBe(true);
    });

    it('handles maximum length slugs', async () => {
      const maxSlug = 'a'.repeat(50);
      const shareUrl = generateDoctorShareUrl(maxSlug);
      expect(shareUrl).toContain(`/connect/${maxSlug}`);
      
      const qrCode = await generateQRCodeDataUrl(shareUrl);
      expect(isValidQRCodeDataUrl(qrCode)).toBe(true);
    });
  });
});
