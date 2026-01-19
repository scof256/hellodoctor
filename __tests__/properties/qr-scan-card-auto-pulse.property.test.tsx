/**
 * Feature: card-animation-fix, Property 1: QR Scan Card Auto-Pulse
 * 
 * For any QR scan page render, the QR scan card should have the auto-pulse animation class applied.
 * 
 * Validates: Requirements 1.1, 1.2
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import ScanQRPage from '@/app/(dashboard)/patient/scan-qr/page';

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useLocalization hook
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.scanQR': 'Scan QR Code',
        'home.scanQRSubtitle': 'Connect with your doctor',
        'home.qrScanUnavailable': 'Camera not available',
        'common.back': 'Back',
      };
      return translations[key] || key;
    },
  }),
}));

describe('Property 1: QR Scan Card Auto-Pulse', () => {
  it('QR scan card should have auto-pulse animation class on page load', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No random input needed, just testing the page render
        () => {
          // Render the QR scan page
          const { container } = render(<ScanQRPage />);

          // Find the ActionCard button (should be the first button with the QR scan title)
          const actionCardButtons = container.querySelectorAll('button');
          
          // Find the QR scan card specifically (it should contain the scan QR text)
          let qrScanCard: Element | null = null;
          actionCardButtons.forEach((button) => {
            if (button.textContent?.includes('Scan QR Code')) {
              qrScanCard = button;
            }
          });

          // Property: QR scan card must exist
          expect(qrScanCard).not.toBeNull();

          if (qrScanCard) {
            // Property: QR scan card must have auto-pulse class
            const hasAutoPulse = qrScanCard.classList.contains('animate-pulse-glow');
            expect(hasAutoPulse).toBe(true);

            // Property: QR scan card should NOT have hover-only pulse class
            const hasHoverPulse = qrScanCard.classList.contains('animate-pulse-glow-hover');
            expect(hasHoverPulse).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('auto-pulse animation should be present regardless of page state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // Simulate different render cycles
        (renderCycle) => {
          // Render the page multiple times to ensure consistency
          const { container } = render(<ScanQRPage key={renderCycle} />);

          // Find the QR scan ActionCard
          const actionCardButtons = container.querySelectorAll('button');
          let qrScanCard: Element | null = null;
          
          actionCardButtons.forEach((button) => {
            if (button.textContent?.includes('Scan QR Code')) {
              qrScanCard = button;
            }
          });

          // Property: Auto-pulse class should always be present
          expect(qrScanCard).not.toBeNull();
          if (qrScanCard) {
            expect(qrScanCard.classList.contains('animate-pulse-glow')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only the QR scan card should have auto-pulse, not other buttons', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Render the page
          const { container } = render(<ScanQRPage />);

          // Find all buttons
          const allButtons = container.querySelectorAll('button');
          
          let qrScanCardFound = false;
          let autoPulseCount = 0;

          allButtons.forEach((button) => {
            const hasAutoPulse = button.classList.contains('animate-pulse-glow');
            
            if (hasAutoPulse) {
              autoPulseCount++;
              
              // Verify it's the QR scan card
              if (button.textContent?.includes('Scan QR Code')) {
                qrScanCardFound = true;
              }
            }
          });

          // Property: Exactly one button should have auto-pulse (the QR scan card)
          expect(autoPulseCount).toBe(1);
          expect(qrScanCardFound).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
