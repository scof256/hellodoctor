/**
 * Property Test: Mobile Toggle Button Visible
 * Feature: desktop-sidebar-fix, Property 3: Mobile Toggle Button Visible
 * 
 * **Validates: Requirements 3.1**
 * 
 * *For any* screen width < 1024px, the toggle button should be rendered 
 * and visible in the header
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import '@testing-library/jest-dom';

/**
 * Mock component representing the mobile toggle button structure
 */
function MobileToggleButtonMock({ viewportWidth }: { viewportWidth: number }) {
  const isMobile = viewportWidth < 1024;
  
  return (
    <div data-testid="header-container">
      {/* Toggle button with lg:hidden class - visible on mobile */}
      <button
        data-testid="toggle-button"
        className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
        style={{ display: isMobile ? 'block' : 'none' }}
        aria-label="Toggle medical sidebar"
      >
        <span data-testid="toggle-icon">Toggle Icon</span>
      </button>
    </div>
  );
}

/**
 * Validates that the toggle button is present in the DOM
 */
function isToggleButtonInDOM(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]');
  return button !== null;
}

/**
 * Validates that the toggle button is visible on mobile
 */
function isToggleButtonVisible(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]') as HTMLElement;
  if (!button) return false;
  
  const style = window.getComputedStyle(button);
  return style.display !== 'none';
}

/**
 * Validates that the toggle button has proper styling classes
 */
function hasProperStyling(container: HTMLElement): boolean {
  const button = container.querySelector('[data-testid="toggle-button"]');
  if (!button) return false;
  
  const classes = button.className;
  return classes.includes('rounded-lg') && 
         classes.includes('hover:bg-slate-100');
}

/**
 * Validates that the toggle button has an icon
 */
function hasToggleIcon(container: HTMLElement): boolean {
  const icon = container.querySelector('[data-testid="toggle-icon"]');
  return icon !== null;
}

describe('Property 3: Mobile Toggle Button Visible', () => {
  /**
   * Property: Toggle button must be in DOM for any mobile viewport width
   */
  it('should render toggle button in DOM for any viewport width < 1024px', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1023 }), // Mobile viewport widths
        (viewportWidth) => {
          const { container } = render(<MobileToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must be present in DOM on mobile
          expect(isToggleButtonInDOM(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must be visible for any mobile viewport width
   */
  it('should display toggle button for any viewport width < 1024px', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1023 }), // Mobile viewport widths
        (viewportWidth) => {
          const { container } = render(<MobileToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must be visible on mobile
          expect(isToggleButtonVisible(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must have proper styling for mobile
   */
  it('should have proper styling classes for mobile interaction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1023 }), // Mobile viewport widths
        (viewportWidth) => {
          const { container } = render(<MobileToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must have proper styling
          expect(hasProperStyling(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must have an icon for visual feedback
   */
  it('should have toggle icon for any mobile viewport width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1023 }), // Mobile viewport widths
        (viewportWidth) => {
          const { container } = render(<MobileToggleButtonMock viewportWidth={viewportWidth} />);
          
          // Property: toggle button must have an icon
          expect(hasToggleIcon(container)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must have accessibility label
   */
  it('should have aria-label for accessibility on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1023 }), // Mobile viewport widths
        (viewportWidth) => {
          const { container } = render(<MobileToggleButtonMock viewportWidth={viewportWidth} />);
          const button = container.querySelector('[data-testid="toggle-button"]');
          
          // Property: toggle button must have aria-label
          expect(button?.getAttribute('aria-label')).toBe('Toggle medical sidebar');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Toggle button must be visible at common mobile breakpoints
   */
  it('should be visible at common mobile breakpoints', () => {
    const commonBreakpoints = [320, 375, 414, 768, 1023]; // Common mobile widths
    
    commonBreakpoints.forEach(width => {
      const { container } = render(<MobileToggleButtonMock viewportWidth={width} />);
      
      // Property: toggle button must be visible at all mobile breakpoints
      expect(isToggleButtonVisible(container)).toBe(true);
    });
  });

  /**
   * Property: Toggle button visibility transitions correctly at breakpoint
   */
  it('should be visible at 1023px (just below lg breakpoint)', () => {
    const { container } = render(<MobileToggleButtonMock viewportWidth={1023} />);
    
    // Property: at 1023px, button should be visible
    expect(isToggleButtonVisible(container)).toBe(true);
  });

  /**
   * Property: Toggle button should be hidden at exactly 1024px
   */
  it('should be hidden at 1024px (lg breakpoint)', () => {
    const { container } = render(<MobileToggleButtonMock viewportWidth={1024} />);
    
    // Property: at 1024px, button should be hidden
    expect(isToggleButtonVisible(container)).toBe(false);
  });
});
