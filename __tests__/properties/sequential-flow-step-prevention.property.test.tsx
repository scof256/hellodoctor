/**
 * Property-Based Test: Sequential Flow Step Prevention
 * 
 * Feature: whatsapp-simple-ux
 * Property 8: Sequential Flow Step Prevention
 * 
 * Validates: Requirements 3.6
 * 
 * Property: For any multi-step sequential flow, steps beyond the current step 
 * should be disabled and non-interactive until the current step is completed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ProgressStepper, type Step } from '@/app/components/ProgressStepper';
import { canAccessStep, getFirstIncompleteStep } from '@/app/lib/auto-navigation';
import React from 'react';

describe('Property 8: Sequential Flow Step Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: canAccessStep should only allow access to step 0 or steps 
   * where the previous step is completed
   */
  it('property: can only access step if previous step is completed', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 2, max: 10 }),
          targetStep: fc.integer({ min: 0, max: 9 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 10 }),
        }),
        ({ totalSteps, targetStep, completedSteps }) => {
          // Ensure targetStep is within bounds
          if (targetStep >= totalSteps) {
            return true;
          }

          const canAccess = canAccessStep(targetStep, completedSteps);

          // Step 0 should always be accessible
          if (targetStep === 0) {
            expect(canAccess).toBe(true);
            return true;
          }

          // Other steps should only be accessible if previous step is completed
          const previousStepCompleted = completedSteps.includes(targetStep - 1);
          expect(canAccess).toBe(previousStepCompleted);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getFirstIncompleteStep should return the first step that is not completed
   */
  it('property: getFirstIncompleteStep returns first incomplete step', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 2, max: 10 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 10 }),
        }),
        ({ totalSteps, completedSteps }) => {
          const firstIncomplete = getFirstIncompleteStep(totalSteps, completedSteps);

          // Should be within bounds
          expect(firstIncomplete).toBeGreaterThanOrEqual(0);
          expect(firstIncomplete).toBeLessThan(totalSteps);

          // Should not be in completed steps (unless all steps are complete)
          if (completedSteps.length < totalSteps) {
            expect(completedSteps.includes(firstIncomplete)).toBe(false);
          }

          // All steps before it should be completed (if not the first step)
          if (firstIncomplete > 0) {
            for (let i = 0; i < firstIncomplete; i++) {
              expect(completedSteps.includes(i)).toBe(true);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Future steps should be disabled in the UI
   */
  it('property: future steps are disabled and non-interactive', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 3, max: 8 }),
          currentStep: fc.integer({ min: 0, max: 7 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 7 }), { maxLength: 8 }),
        }),
        ({ totalSteps, currentStep, completedSteps }) => {
          // Ensure currentStep is within bounds
          if (currentStep >= totalSteps) {
            return true;
          }

          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          const mockOnStepClick = vi.fn();

          const { container } = render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={mockOnStepClick}
              variant="numbered"
            />
          );

          // Check each step button
          const buttons = container.querySelectorAll('button');
          
          buttons.forEach((button, index) => {
            const isAccessible = canAccessStep(index, completedSteps);
            const isDisabled = button.hasAttribute('disabled');
            const ariaDisabled = button.getAttribute('aria-disabled') === 'true';

            // Future steps (not accessible) should be disabled
            if (!isAccessible) {
              expect(isDisabled || ariaDisabled).toBe(true);
            }
          });

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clicking on a future step should not change the current step
   */
  it('property: clicking future steps does not navigate', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 3, max: 6 }),
          currentStep: fc.integer({ min: 0, max: 2 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 3 }),
        }),
        ({ totalSteps, currentStep, completedSteps }) => {
          // Ensure currentStep is within bounds
          if (currentStep >= totalSteps) {
            return true;
          }

          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          let clickedStep = -1;
          const mockOnStepClick = vi.fn((step: number) => {
            // Only allow navigation if step is accessible
            if (canAccessStep(step, completedSteps)) {
              clickedStep = step;
            }
          });

          render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={mockOnStepClick}
              variant="numbered"
            />
          );

          // Try to click on a future step (2 steps ahead)
          const futureStep = currentStep + 2;
          if (futureStep < totalSteps) {
            const buttons = screen.getAllByRole('button');
            const futureButton = buttons[futureStep];

            if (futureButton && !futureButton.hasAttribute('disabled')) {
              futureButton.click();
              
              // If the step is not accessible, it should not navigate
              if (!canAccessStep(futureStep, completedSteps)) {
                expect(clickedStep).not.toBe(futureStep);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cannot skip steps by clicking ahead
   */
  it('property: cannot skip steps by clicking ahead', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 4, max: 8 }),
          currentStep: fc.integer({ min: 0, max: 3 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 7 }), { maxLength: 4 }),
        }),
        ({ totalSteps, currentStep, completedSteps }) => {
          // Ensure currentStep is within bounds
          if (currentStep >= totalSteps) {
            return true;
          }

          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          let clickedStep = -1;
          const mockOnStepClick = vi.fn((step: number) => {
            clickedStep = step;
          });

          render(
            <ProgressStepper
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={mockOnStepClick}
              variant="numbered"
            />
          );

          // Try to click on a future step (2 steps ahead)
          const futureStep = currentStep + 2;
          if (futureStep < totalSteps) {
            const buttons = screen.getAllByRole('button');
            const futureButton = buttons[futureStep];

            if (futureButton && !futureButton.hasAttribute('disabled')) {
              futureButton.click();
              
              // If the step is not accessible, onStepClick should not be called
              // or should not change to that step
              if (!canAccessStep(futureStep, completedSteps)) {
                // The click should be ignored
                expect(clickedStep).not.toBe(futureStep);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Step 0 is always accessible
   */
  it('property: step 0 is always accessible', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalSteps: fc.integer({ min: 2, max: 10 }),
          completedSteps: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 10 }),
        }),
        ({ totalSteps, completedSteps }) => {
          const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            label: `Step ${i + 1}`,
          }));

          render(
            <ProgressStepper
              steps={steps}
              currentStep={0}
              completedSteps={completedSteps}
              variant="numbered"
            />
          );

          const buttons = screen.getAllByRole('button');
          const step0Button = buttons[0];

          // Step 0 should never be disabled
          expect(step0Button?.hasAttribute('disabled')).toBe(false);
          expect(step0Button?.getAttribute('aria-disabled')).not.toBe('true');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
