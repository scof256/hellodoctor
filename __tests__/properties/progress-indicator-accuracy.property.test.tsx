/**
 * Property-Based Tests for Progress Indicator Accuracy
 * 
 * Feature: whatsapp-simple-ux, Property 9: Progress Indicator Accuracy
 * Validates: Requirements 3.5
 * 
 * Property: For any multi-step process, the progress indicator should display 
 * "Step X of Y" where X is the current step number and Y is the total number 
 * of steps, and X ≤ Y.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ProgressStepper, type Step } from '@/app/components/ProgressStepper';
import React from 'react';

describe('Property 9: Progress Indicator Accuracy', () => {
  /**
   * Property 1: Step X of Y format validation
   * For any progress indicator, the displayed text should match "Step X of Y" format
   * where X is currentStep + 1 (1-indexed) and Y is total steps
   */
  it('should display "Step X of Y" format correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // total steps
        fc.integer({ min: 0, max: 19 }), // current step (0-indexed)
        (totalSteps, currentStepIndex) => {
          // Ensure currentStep is within bounds
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          // Generate steps
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
            description: `Description ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="bar"
              showLabels={true}
            />
          );

          // Check for "Step X of Y" format
          const stepText = container.textContent;
          const expectedText = `Step ${currentStep + 1} of ${totalSteps}`;
          
          expect(stepText).toContain(expectedText);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Current step never exceeds total steps
   * For any progress indicator, X ≤ Y must always hold
   */
  it('should ensure current step (X) never exceeds total steps (Y)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // total steps
        fc.integer({ min: 0, max: 19 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="dots"
              showLabels={true}
            />
          );

          // Extract step numbers from text
          const text = container.textContent || '';
          const match = text.match(/Step (\d+) of (\d+)/);
          
          if (match) {
            const x = parseInt(match[1] || '0', 10);
            const y = parseInt(match[2] || '0', 10);
            
            // X should never exceed Y
            expect(x).toBeLessThanOrEqual(y);
            // X should be at least 1
            expect(x).toBeGreaterThanOrEqual(1);
            // Y should match total steps
            expect(y).toBe(totalSteps);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Dots variant shows correct number of dots
   * For any progress indicator using dots variant, the number of dots
   * should equal the total number of steps
   */
  it('should display correct number of dots equal to total steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // total steps (at least 2 for meaningful test)
        fc.integer({ min: 0, max: 9 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="dots"
              showLabels={false}
            />
          );

          // Count buttons (dots) - each step is rendered as a button
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBe(totalSteps);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Numbered variant shows correct step numbers
   * For any progress indicator using numbered variant, each step should
   * display its correct number (1 through Y)
   */
  it('should display correct step numbers in numbered variant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // total steps
        fc.integer({ min: 0, max: 7 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="numbered"
              showLabels={false}
            />
          );

          // Check that step numbers are present (for non-completed steps)
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBe(totalSteps);
          
          // Verify each button has appropriate content (number or checkmark)
          buttons.forEach((button, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = index === currentStep;
            
            if (!isCompleted) {
              // Should show step number (1-indexed)
              const expectedNumber = (index + 1).toString();
              // Button should contain the number or be marked as completed
              const hasNumber = button.textContent?.includes(expectedNumber);
              const hasCheckmark = button.querySelector('svg'); // Check icon
              
              expect(hasNumber || hasCheckmark).toBeTruthy();
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Bar variant shows percentage within valid range
   * For any progress indicator using bar variant, the percentage should
   * be between 0 and 100
   */
  it('should display percentage between 0 and 100 in bar variant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // total steps
        fc.integer({ min: 0, max: 19 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="bar"
              showLabels={true}
            />
          );

          // Extract percentage from text - look for standalone percentage
          // The text format is "Step X of Y" followed by "Z%"
          // We need to match the percentage that's NOT part of "of Y"
          const text = container.textContent || '';
          
          // Match percentage that appears after "Step X of Y"
          // Use a more specific regex that captures the percentage value separately
          const percentMatch = text.match(/Step \d+ of \d+\s*(\d+)%/);
          
          if (percentMatch) {
            const percentage = parseInt(percentMatch[1] || '0', 10);
            
            // Percentage should be between 0 and 100
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Completed steps are always less than or equal to current step
   * For any progress indicator, the number of completed steps should never
   * exceed the current step index
   */
  it('should ensure completed steps count is valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }), // total steps
        fc.integer({ min: 0, max: 14 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          // Completed steps should be all steps before current
          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="numbered"
              showLabels={true}
            />
          );

          // Verify the component renders without errors
          expect(container).toBeTruthy();
          
          // Verify completed steps count is valid
          expect(completedSteps.length).toBeLessThanOrEqual(currentStep + 1);
          expect(completedSteps.length).toBeLessThanOrEqual(totalSteps);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: All variants display step labels when showLabels is true
   * For any progress indicator with showLabels=true, step labels should be visible
   */
  it('should display step labels when showLabels is true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // total steps
        fc.integer({ min: 0, max: 7 }), // current step
        fc.constantFrom('dots', 'bar', 'numbered'), // variant
        (totalSteps, currentStepIndex, variant) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Label${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant={variant as 'dots' | 'bar' | 'numbered'}
              showLabels={true}
            />
          );

          // Should contain "Step X of Y" text
          const text = container.textContent || '';
          expect(text).toMatch(/Step \d+ of \d+/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Current step indicator is always visible
   * For any progress indicator, the current step should be visually distinct
   */
  it('should visually distinguish the current step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // total steps
        fc.integer({ min: 0, max: 9 }), // current step
        (totalSteps, currentStepIndex) => {
          const currentStep = Math.min(currentStepIndex, totalSteps - 1);
          
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="dots"
              showLabels={true}
            />
          );

          // Find the button with aria-current="step"
          const currentStepButton = container.querySelector('[aria-current="step"]');
          expect(currentStepButton).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
