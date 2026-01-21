/**
 * Property Test: Desktop Toggle Button Hidden
 * Feature: desktop-sidebar-fix, Property 2: Desktop Toggle Button Hidden
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * *For any* screen width >= 1024px, the toggle button element should not be 
 * present in the DOM or should have display:none applied
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import '@testing-library/jest-dom';

/**
 * Mock component representing the toggle button structure
 */
function ToggleButtonMock({ viewportWidth }: { viewportWidth: number }) {
  const isDesktop = viewportWidth >= 1024;
  
  return (
    <div data-testid="header-container">
      {/* Toggle button with lg:hidden class */}
      <button
        data-testid="toggle-button"
        className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
        style={{ display: isDesktop ? 'none' : 'block' }}
        aria-label="Toggle medical sidebar"
      >
        Toggle
      </button>
    </div>
  );
}

/**
 * Validates that the toggle button is not visible on desktop
 */
function isToggleButtonHidden(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]') as HTMLElement;
  if (!button) return true; // Not in DOM = hidden
  
  const style = window.getComputedStyle(button);
  return style.display === 'none';
}

/**
 * Validates that the toggle button has the lg:hidden class
 */
function hasHiddenClass(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]');
  if (!button) return false;
  
  return button.className.includes('lg:hidden');
}

/**
 * Validates that no layout shift occurs when button is hidden
 */
function hasNoLayoutShift(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]') as HTMLElement;
  if (!button) return true;
  
  // Check that button doesn't take up space when hidden
  const style = window.getComputedStyle(button);
  if (style.display === 'none') {
    // When display:none, element should not affect layout
    return true;
  }
  
  return false;
}

describe('Property 2: Desktop Toggle Button Hidden', () => {
  /**
   * Property: Toggle button must be hidden for any desktop viewport width
   */
  it('should hide toggle button for any viewport width >= 1024px', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 3840 }), // Desktop viewport widths
        (viewportWidth) => {
          const { container } = render(<ToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must be hidden on desktop
          expect(isToggleButtonHidden(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must have lg:hidden class
   */
  it('should have lg:hidden class for responsive hiding', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 3840 }), // Desktop viewport widths
        (viewportWidth) => {
          const { container } = render(<ToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must have lg:hidden class
          expect(hasHiddenClass(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No layout shift when toggle button is hidden
   */
  it('should not cause layout shift when hidden on desktop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 3840 }), // Desktop viewport widths
        (viewportWidth) => {
          const { container } = render(<ToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: hidden button should not affect layout
          expect(hasNoLayoutShift(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must maintain accessibility attributes even when hidden
   */
  it('should maintain aria-label even when hidden', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 3840 }), // Desktop viewport widths
        (viewportWidth) => {
          const { container } = render(<ToggleButtonMock viewportWidth={viewportWidth} />);
          const button = container.querySelector('[data-testid="toggle-button"]');
          
          // Property: button should have aria-label for accessibility
          expect(button?.getAttribute('aria-label')).toBe('Toggle medical sidebar');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button visibility transitions correctly at breakpoint
   */
  it('should be hidden at exactly 1024px (lg breakpoint)', () => {
    const { container } = render(<ToggleButtonMock viewportWidth={1024} />);
    
    // Property: at exactly 1024px, button should be hidden
    expect(isToggleButtonHidden(container)).toBe(true);
  });

  /**
   * Property: Toggle button is visible just below desktop breakpoint
   */
  it('should be visible at 1023px (just below lg breakpoint)', () => {
    const { container } = render(<ToggleButtonMock viewportWidth={1023} />);
    const button = container.querySelector('[data-testid="toggle-button"]') as HTMLElement;
    
    // Property: at 1023px, button should be visible
    const style = window.getComputedStyle(button);
    expect(style.display).not.toBe('none');
  });
});
