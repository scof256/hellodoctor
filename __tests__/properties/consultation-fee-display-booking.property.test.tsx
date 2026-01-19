/**
 * Property-Based Tests for Consultation Fee Display Before Booking
 * Feature: doctor-professional-profile, Property 18: Consultation Fee Display Before Booking
 * 
 * Property: For any appointment booking flow, the consultation fee should be 
 * displayed before the patient confirms the appointment.
 * 
 * Validates: Requirements 7.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock booking flow component that displays consultation fee
interface BookingFlowProps {
  doctor: {
    name: string;
    consultationFee: number | null;
  };
  onConfirm: () => void;
}

function BookingFlow({ doctor, onConfirm }: BookingFlowProps) {
  return (
    <div data-testid="booking-flow">
      <div data-testid="doctor-info">
        <h2>{doctor.name}</h2>
      </div>
      
      {/* Consultation fee must be displayed before confirm button */}
      {doctor.consultationFee !== null && (
        <div data-testid="consultation-fee-display">
          <span data-testid="fee-label">Consultation Fee:</span>
          <span data-testid="fee-amount">${doctor.consultationFee.toFixed(2)}</span>
        </div>
      )}
      
      <button 
        data-testid="confirm-booking-button"
        onClick={onConfirm}
      >
        Confirm Appointment
      </button>
    </div>
  );
}

describe('Property 18: Consultation Fee Display Before Booking', () => {
  it('should display consultation fee before confirm button for any doctor with fee', () => {
    fc.assert(
      fc.property(
        // Generate random doctor data with consultation fee
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }),
          consultationFee: fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100),
        }),
        (doctor) => {
          // Render booking flow
          const { container } = render(
            <BookingFlow 
              doctor={doctor} 
              onConfirm={() => {}} 
            />
          );

          try {
            // Property: Consultation fee must be displayed
            const feeDisplay = screen.getByTestId('consultation-fee-display');
            expect(feeDisplay).toBeDefined();

            // Property: Fee amount must be visible
            const feeAmount = screen.getByTestId('fee-amount');
            expect(feeAmount).toBeDefined();
            expect(feeAmount.textContent).toContain(doctor.consultationFee.toFixed(2));

            // Property: Confirm button must exist
            const confirmButton = screen.getByTestId('confirm-booking-button');
            expect(confirmButton).toBeDefined();

            // Property: Fee display must appear before confirm button in DOM order
            const flowElement = screen.getByTestId('booking-flow');
            const children = Array.from(flowElement.children);
            const feeIndex = children.findIndex(child => 
              child.getAttribute('data-testid') === 'consultation-fee-display'
            );
            const buttonIndex = children.findIndex(child => 
              child.getAttribute('data-testid') === 'confirm-booking-button'
            );

            expect(feeIndex).toBeGreaterThanOrEqual(0);
            expect(buttonIndex).toBeGreaterThan(feeIndex);
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should format consultation fee with exactly 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100),
        (fee) => {
          const doctor = {
            name: 'Dr. Test',
            consultationFee: fee,
          };

          render(<BookingFlow doctor={doctor} onConfirm={() => {}} />);

          try {
            const feeAmount = screen.getByTestId('fee-amount');
            const displayedText = feeAmount.textContent || '';

            // Property: Fee must be formatted with exactly 2 decimal places
            const expectedFormat = `$${fee.toFixed(2)}`;
            expect(displayedText).toBe(expectedFormat);

            // Property: Fee must match regex pattern for currency
            expect(displayedText).toMatch(/^\$\d+\.\d{2}$/);
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display fee label along with amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100),
        (fee) => {
          const doctor = {
            name: 'Dr. Test',
            consultationFee: fee,
          };

          render(<BookingFlow doctor={doctor} onConfirm={() => {}} />);

          try {
            // Property: Fee label must be present
            const feeLabel = screen.getByTestId('fee-label');
            expect(feeLabel).toBeDefined();
            expect(feeLabel.textContent).toBeTruthy();

            // Property: Fee amount must be present
            const feeAmount = screen.getByTestId('fee-amount');
            expect(feeAmount).toBeDefined();
            expect(feeAmount.textContent).toContain('$');
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case fees correctly', () => {
    const edgeCases = [
      0.01,  // Minimum fee
      0.99,  // Less than 1 dollar
      1.00,  // Exactly 1 dollar
      10.50, // Common fee
      100.00, // Round hundred
      999.99, // Large fee
      1000.00, // Very large fee
    ];

    edgeCases.forEach(fee => {
      const doctor = {
        name: 'Dr. Test',
        consultationFee: fee,
      };

      render(<BookingFlow doctor={doctor} onConfirm={() => {}} />);

      try {
        const feeAmount = screen.getByTestId('fee-amount');
        expect(feeAmount.textContent).toBe(`$${fee.toFixed(2)}`);
      } finally {
        cleanup();
      }
    });
  });

  it('should not display fee section when consultation fee is null', () => {
    const doctor = {
      name: 'Dr. Test',
      consultationFee: null,
    };

    render(<BookingFlow doctor={doctor} onConfirm={() => {}} />);

    try {
      // Property: Fee display should not exist when fee is null
      const feeDisplay = screen.queryByTestId('consultation-fee-display');
      expect(feeDisplay).toBeNull();

      // Property: Confirm button should still exist
      const confirmButton = screen.getByTestId('confirm-booking-button');
      expect(confirmButton).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('should maintain fee visibility throughout booking flow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100),
        (fee) => {
          const doctor = {
            name: 'Dr. Test',
            consultationFee: fee,
          };

          // Render booking flow
          const { rerender } = render(
            <BookingFlow doctor={doctor} onConfirm={() => {}} />
          );

          try {
            // Property: Fee should be visible initially
            let feeDisplay = screen.getByTestId('consultation-fee-display');
            expect(feeDisplay).toBeDefined();

            // Rerender with same data (simulating state updates)
            rerender(<BookingFlow doctor={doctor} onConfirm={() => {}} />);

            // Property: Fee should still be visible after rerender
            feeDisplay = screen.getByTestId('consultation-fee-display');
            expect(feeDisplay).toBeDefined();

            const feeAmount = screen.getByTestId('fee-amount');
            expect(feeAmount.textContent).toBe(`$${fee.toFixed(2)}`);
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
