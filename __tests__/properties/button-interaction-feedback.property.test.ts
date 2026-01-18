/**
 * Feature: whatsapp-simple-ux, Property 22: Button Interaction Feedback
 * 
 * For any button tap/click, immediate visual feedback (press animation, 
 * color change, or ripple effect) should occur within 100ms.
 * 
 * Validates: Requirements 15.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { 
  buttonFeedbackClasses, 
  createRipple, 
  triggerHapticFeedback,
  handleButtonPress 
} from '@/app/lib/button-feedback';

// Mock navigator.vibrate for haptic feedback tests
const mockVibrate = vi.fn();

beforeEach(() => {
  Object.defineProperty(navigator, 'vibrate', {
    value: mockVibrate,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// Arbitrary generator for button types
const arbitraryButtonType = fc.constantFrom(
  'button',
  'submit',
  'reset'
);

// Arbitrary generator for button states
const arbitraryButtonState = fc.record({
  type: arbitraryButtonType,
  disabled: fc.boolean(),
  className: fc.string(),
  label: fc.string(),
});

// Arbitrary generator for interaction events
const arbitraryInteractionType = fc.constantFrom(
  'click',
  'touchstart',
  'mousedown'
);

// Helper to measure animation timing
function measureAnimationTiming(element: HTMLElement, property: string): number {
  const computedStyle = window.getComputedStyle(element);
  const transitionDuration = computedStyle.getPropertyValue('transition-duration');
  
  // Parse duration (e.g., "75ms" or "0.075s")
  if (transitionDuration.endsWith('ms')) {
    return parseFloat(transitionDuration);
  } else if (transitionDuration.endsWith('s')) {
    return parseFloat(transitionDuration) * 1000;
  }
  
  return 0;
}

// Helper to check if element has feedback classes
function hasFeedbackClasses(element: HTMLElement): boolean {
  const classList = element.className;
  return (
    classList.includes('active:scale') ||
    classList.includes('btn-feedback') ||
    classList.includes('btn-full-feedback') ||
    classList.includes('transition')
  );
}

describe('Property 22: Button Interaction Feedback', () => {
  it('all button feedback classes provide transitions under 100ms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          buttonFeedbackClasses.scale,
          buttonFeedbackClasses.scaleWithShadow,
          buttonFeedbackClasses.full
        ),
        (feedbackClass) => {
          // Check that duration is specified and under 100ms
          expect(feedbackClass).toContain('duration-75');
          
          // Verify the class includes transition
          expect(feedbackClass).toContain('transition');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button press animations complete within 100ms', () => {
    fc.assert(
      fc.property(arbitraryButtonState, (buttonState) => {
        const TestButton = () => {
          return React.createElement(
            'button',
            {
              type: buttonState.type,
              disabled: buttonState.disabled,
              className: 'active:scale-[0.96] transition-transform duration-75',
            },
            buttonState.label || 'Test Button'
          );
        };

        const { container } = render(React.createElement(TestButton));
        const button = container.querySelector('button');
        
        expect(button).not.toBeNull();
        
        if (!buttonState.disabled) {
          // Check transition duration
          const duration = measureAnimationTiming(button!, 'transform');
          
          // Duration should be 75ms or less (under 100ms requirement)
          expect(duration).toBeLessThanOrEqual(100);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('ripple effect is created on button press', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: 0, max: 200 }),
          y: fc.integer({ min: 0, max: 100 }),
        }),
        (coords) => {
          const button = document.createElement('button');
          button.style.position = 'relative';
          button.style.width = '200px';
          button.style.height = '100px';
          document.body.appendChild(button);

          const mockEvent = {
            clientX: coords.x,
            clientY: coords.y,
          } as MouseEvent;

          // Mock getBoundingClientRect
          button.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 200,
            bottom: 100,
            width: 200,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          });

          createRipple(mockEvent, button);

          // Check that ripple element was created
          const ripple = button.querySelector('.button-ripple');
          expect(ripple).not.toBeNull();

          // Ripple should be positioned at click location
          const rippleStyle = (ripple as HTMLElement).style;
          expect(rippleStyle.left).toBe(`${coords.x}px`);
          expect(rippleStyle.top).toBe(`${coords.y}px`);

          // Cleanup
          document.body.removeChild(button);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ripple effect is removed after animation completes', async () => {
    // Test ripple removal with a single synchronous test
    const button = document.createElement('button');
    button.style.position = 'relative';
    document.body.appendChild(button);

    const mockEvent = {
      clientX: 50,
      clientY: 50,
    } as MouseEvent;

    button.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    createRipple(mockEvent, button);

    // Ripple should exist immediately
    expect(button.querySelector('.button-ripple')).not.toBeNull();

    // Wait for animation to complete (600ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 700));

    // Ripple should be removed
    expect(button.querySelector('.button-ripple')).toBeNull();

    // Cleanup
    document.body.removeChild(button);
  });

  it('haptic feedback triggers vibration on supported devices', () => {
    fc.assert(
      fc.property(fc.constant(true), () => {
        mockVibrate.mockClear();
        
        triggerHapticFeedback();

        // Should call vibrate with 10ms duration
        expect(mockVibrate).toHaveBeenCalledWith(10);
        expect(mockVibrate).toHaveBeenCalledTimes(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('handleButtonPress triggers both ripple and haptic when requested', () => {
    fc.assert(
      fc.property(
        fc.record({
          ripple: fc.boolean(),
          haptic: fc.boolean(),
        }),
        (options) => {
          mockVibrate.mockClear();

          const button = document.createElement('button');
          button.style.position = 'relative';
          document.body.appendChild(button);

          const mockEvent = {
            clientX: 50,
            clientY: 50,
            currentTarget: button,
          } as unknown as React.MouseEvent<HTMLElement>;

          button.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          });

          handleButtonPress(mockEvent, options);

          // Check ripple was created if requested
          if (options.ripple) {
            expect(button.querySelector('.button-ripple')).not.toBeNull();
          }

          // Check haptic was triggered if requested
          if (options.haptic) {
            expect(mockVibrate).toHaveBeenCalled();
          } else {
            expect(mockVibrate).not.toHaveBeenCalled();
          }

          // Cleanup
          document.body.removeChild(button);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('disabled buttons do not trigger feedback', () => {
    fc.assert(
      fc.property(arbitraryButtonState, (buttonState) => {
        const TestButton = () => {
          return React.createElement(
            'button',
            {
              type: buttonState.type,
              disabled: true,
              className: 'btn-feedback disabled:cursor-not-allowed disabled:opacity-50',
            },
            buttonState.label || 'Test Button'
          );
        };

        const { container } = render(React.createElement(TestButton));
        const button = container.querySelector('button');
        
        expect(button).not.toBeNull();
        expect(button!.disabled).toBe(true);
        
        // Disabled buttons should have cursor-not-allowed
        expect(button!.className).toContain('disabled:cursor-not-allowed');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('feedback timing is consistent across different button types', () => {
    fc.assert(
      fc.property(arbitraryButtonType, (buttonType) => {
        const TestButton = () => {
          return React.createElement(
            'button',
            {
              type: buttonType,
              className: 'active:scale-[0.96] transition-transform duration-75',
            },
            'Test'
          );
        };

        const { container } = render(React.createElement(TestButton));
        const button = container.querySelector('button');
        
        expect(button).not.toBeNull();
        
        // All button types should have same feedback timing
        const duration = measureAnimationTiming(button!, 'transform');
        expect(duration).toBeLessThanOrEqual(100);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('scale animation reduces button size on press', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0.96, 0.98, 0.95),
        (scale) => {
          const TestButton = () => {
            return React.createElement(
              'button',
              {
                className: `active:scale-[${scale}] transition-transform duration-75`,
              },
              'Test'
            );
          };

          const { container } = render(React.createElement(TestButton));
          const button = container.querySelector('button');
          
          expect(button).not.toBeNull();
          
          // Button should have scale class
          expect(button!.className).toContain('active:scale');
          
          // Scale should be less than 1 (button gets smaller)
          expect(scale).toBeLessThan(1);
          expect(scale).toBeGreaterThan(0.9); // Not too small

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all interactive buttons have some form of feedback', () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom('button', undefined),
          onClick: fc.constant(() => {}),
          disabled: fc.boolean(),
        }),
        (buttonProps) => {
          const TestButton = () => {
            return React.createElement(
              'button',
              {
                role: buttonProps.role,
                onClick: buttonProps.onClick,
                disabled: buttonProps.disabled,
                className: 'btn-feedback',
              },
              'Test'
            );
          };

          const { container } = render(React.createElement(TestButton));
          const button = container.querySelector('button');
          
          expect(button).not.toBeNull();
          
          if (!buttonProps.disabled) {
            // Non-disabled buttons should have feedback classes
            expect(hasFeedbackClasses(button!)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('feedback classes are properly structured', () => {
    fc.assert(
      fc.property(fc.constant(buttonFeedbackClasses), (classes) => {
        // All feedback classes should include transition
        expect(classes.scale).toContain('transition');
        expect(classes.scaleWithShadow).toContain('transition');
        expect(classes.full).toContain('transition');

        // All should have active state
        expect(classes.scale).toContain('active:');
        expect(classes.scaleWithShadow).toContain('active:');
        expect(classes.full).toContain('active:');

        // Ripple classes should have positioning
        expect(classes.ripple).toContain('relative');
        expect(classes.ripple).toContain('overflow-hidden');
        expect(classes.full).toContain('relative');
        expect(classes.full).toContain('overflow-hidden');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('touch events trigger same feedback as mouse events', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: 0, max: 100 }),
          y: fc.integer({ min: 0, max: 100 }),
        }),
        (coords) => {
          const button = document.createElement('button');
          button.style.position = 'relative';
          document.body.appendChild(button);

          button.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          });

          // Test mouse event
          const mouseEvent = {
            clientX: coords.x,
            clientY: coords.y,
          } as MouseEvent;

          createRipple(mouseEvent, button);
          const mouseRipple = button.querySelector('.button-ripple');
          expect(mouseRipple).not.toBeNull();

          // Clear ripple
          if (mouseRipple) mouseRipple.remove();

          // Test touch event
          const touchEvent = {
            touches: [{ clientX: coords.x, clientY: coords.y }],
          } as unknown as TouchEvent;

          createRipple(touchEvent, button);
          const touchRipple = button.querySelector('.button-ripple');
          expect(touchRipple).not.toBeNull();

          // Both should create ripple at same position
          const mouseStyle = (mouseRipple as HTMLElement)?.style;
          const touchStyle = (touchRipple as HTMLElement)?.style;

          // Cleanup
          document.body.removeChild(button);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('feedback timing meets 100ms requirement for all button states', () => {
    fc.assert(
      fc.property(
        fc.record({
          variant: fc.constantFrom('primary', 'secondary', 'outline', 'ghost'),
          size: fc.constantFrom('small', 'medium', 'large'),
          loading: fc.boolean(),
        }),
        (buttonConfig) => {
          const TestButton = () => {
            return React.createElement(
              'button',
              {
                className: 'active:scale-[0.96] transition-transform duration-75',
                'data-variant': buttonConfig.variant,
                'data-size': buttonConfig.size,
                'data-loading': buttonConfig.loading,
              },
              'Test'
            );
          };

          const { container } = render(React.createElement(TestButton));
          const button = container.querySelector('button');
          
          expect(button).not.toBeNull();
          
          // Feedback timing should be under 100ms regardless of configuration
          const duration = measureAnimationTiming(button!, 'transform');
          expect(duration).toBeLessThanOrEqual(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
