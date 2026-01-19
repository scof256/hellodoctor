/**
 * Feature: card-animation-fix, Property 2: Home Card Hover-Only Pulse
 * 
 * For any home page action card, the pulse animation should only be active during hover state, not by default.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { SimplifiedPatientHome } from '@/app/components/SimplifiedPatientHome';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Helper to create mock connection
function createMockConnection(
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed',
  completeness: number = 0
): ConnectionSummary {
  return {
    id: fc.sample(fc.uuid(), 1)[0],
    doctor: {
      id: fc.sample(fc.uuid(), 1)[0],
      firstName: fc.sample(fc.string({ minLength: 3, maxLength: 10 }), 1)[0],
      lastName: fc.sample(fc.string({ minLength: 3, maxLength: 10 }), 1)[0],
      specialty: 'General Practice',
      imageUrl: null,
    },
    intakeStatus: {
      status,
      completeness,
    },
  };
}

// Helper to create mock appointment
function createMockAppointment(): AppointmentSummary {
  return {
    id: fc.sample(fc.uuid(), 1)[0],
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'scheduled',
    doctor: {
      id: fc.sample(fc.uuid(), 1)[0],
      firstName: fc.sample(fc.string({ minLength: 3, maxLength: 10 }), 1)[0],
      lastName: fc.sample(fc.string({ minLength: 3, maxLength: 10 }), 1)[0],
    },
  };
}

// Arbitrary generator for connection states
const arbitraryConnectionState = fc.constantFrom(
  'not_started',
  'in_progress',
  'ready',
  'reviewed'
) as fc.Arbitrary<'not_started' | 'in_progress' | 'ready' | 'reviewed'>;

// Arbitrary generator for completeness percentage
const arbitraryCompleteness = fc.integer({ min: 0, max: 100 });

describe('Property 2: Home Card Hover-Only Pulse', () => {
  it('all home page action cards should have hover-pulse class, not auto-pulse', () => {
    fc.assert(
      fc.property(
        arbitraryConnectionState,
        arbitraryCompleteness,
        fc.boolean(),
        (intakeStatus, completeness, hasAppointment) => {
          // Create test data
          const connections = [createMockConnection(intakeStatus, completeness)];
          const appointments = hasAppointment ? [createMockAppointment()] : [];

          // Render component
          const { container } = render(
            <SimplifiedPatientHome 
              connections={connections} 
              appointments={appointments} 
            />
          );

          // Find all action card buttons
          const actionCards = container.querySelectorAll('button');

          // Property: All action cards should have hover-pulse class
          actionCards.forEach((card) => {
            const hasHoverPulse = card.classList.contains('animate-pulse-glow-hover');
            const hasAutoPulse = card.classList.contains('animate-pulse-glow');

            // Each card should have hover-pulse class
            expect(hasHoverPulse).toBe(true);
            
            // No card should have auto-pulse class (that's for QR scan page only)
            expect(hasAutoPulse).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('action cards should not pulse by default (only on hover)', () => {
    fc.assert(
      fc.property(
        arbitraryConnectionState,
        arbitraryCompleteness,
        (intakeStatus, completeness) => {
          // Create test data
          const connections = [createMockConnection(intakeStatus, completeness)];

          // Render component
          const { container } = render(
            <SimplifiedPatientHome 
              connections={connections} 
              appointments={[]} 
            />
          );

          // Find all action card buttons
          const actionCards = container.querySelectorAll('button');

          // Property: Cards should have hover-only animation class
          actionCards.forEach((card) => {
            // Should have the hover-pulse class
            expect(card.classList.contains('animate-pulse-glow-hover')).toBe(true);
            
            // Should NOT have the auto-pulse class
            expect(card.classList.contains('animate-pulse-glow')).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card should also use hover-pulse on home page', () => {
    fc.assert(
      fc.property(
        arbitraryConnectionState,
        arbitraryCompleteness,
        (intakeStatus, completeness) => {
          // Create test data
          const connections = [createMockConnection(intakeStatus, completeness)];

          // Render component
          const { container } = render(
            <SimplifiedPatientHome 
              connections={connections} 
              appointments={[]} 
            />
          );

          // Find all action card buttons (QR scan card should be first)
          const actionCards = container.querySelectorAll('button');
          
          // Property: First card (QR scan) should use hover-pulse
          expect(actionCards.length).toBeGreaterThan(0);
          const firstCard = actionCards[0];
          
          expect(firstCard.classList.contains('animate-pulse-glow-hover')).toBe(true);
          expect(firstCard.classList.contains('animate-pulse-glow')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
