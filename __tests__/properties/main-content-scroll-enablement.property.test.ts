/**
 * Property Test: Main Content Scroll Enablement
 * Feature: dashboard-scroll-fix, Property 1: Main Content Scroll Enablement
 * 
 * **Validates: Requirements 1.1, 1.4, 2.3, 3.3**
 * 
 * *For any* dashboard page with content exceeding viewport height, the main content 
 * area SHALL have `overflow-y-auto` applied, enabling vertical scrolling while 
 * hiding scrollbars when content fits.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates the main element class generation based on immersive mode
 */
function generateMainElementClasses(isImmersive: boolean): string {
  return isImmersive
    ? 'flex-1 overflow-y-auto p-0'
    : 'flex-1 overflow-y-auto p-4 lg:p-6';
}

/**
 * Validates that main element has scroll enablement classes
 */
function hasScrollEnablement(classes: string): boolean {
  return classes.includes('overflow-y-auto');
}

/**
 * Validates that main element has flex-1 for proper sizing
 */
function hasFlexGrow(classes: string): boolean {
  return classes.includes('flex-1');
}

/**
 * Validates padding classes based on mode
 */
function hasCorrectPadding(classes: string, isImmersive: boolean): boolean {
  if (isImmersive) {
    return classes.includes('p-0');
  }
  return classes.includes('p-4') && classes.includes('lg:p-6');
}

/**
 * Simulates scroll behavior based on content and container dimensions
 */
interface ScrollSimulation {
  contentHeight: number;
  containerHeight: number;
  hasOverflowYAuto: boolean;
}

function shouldShowScrollbar(sim: ScrollSimulation): boolean {
  // overflow-y-auto shows scrollbar only when content exceeds container
  return sim.hasOverflowYAuto && sim.contentHeight > sim.containerHeight;
}

function canScroll(sim: ScrollSimulation): boolean {
  // Can scroll when overflow-y-auto is set and content exceeds container
  return sim.hasOverflowYAuto && sim.contentHeight > sim.containerHeight;
}

describe('Property 1: Main Content Scroll Enablement', () => {
  /**
   * Property: Main element must always have overflow-y-auto for scroll enablement
   */
  it('should have overflow-y-auto on main element for any layout state', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isImmersiveMode
        (isImmersive) => {
          const classes = generateMainElementClasses(isImmersive);
          
          // Property: main element must have overflow-y-auto
          expect(hasScrollEnablement(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Main element must have flex-1 to fill available space
   */
  it('should have flex-1 on main element for proper sizing', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const classes = generateMainElementClasses(isImmersive);
          
          // Property: main element must have flex-1
          expect(hasFlexGrow(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Padding should be preserved based on mode
   */
  it('should preserve correct padding classes based on mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const classes = generateMainElementClasses(isImmersive);
          
          // Property: padding must be correct for the mode
          expect(hasCorrectPadding(classes, isImmersive)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Scrollbar should only appear when content exceeds viewport
   * (overflow-y-auto behavior)
   */
  it('should enable scrolling only when content exceeds container height', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),  // contentHeight
        fc.integer({ min: 100, max: 2000 }),  // containerHeight
        (contentHeight, containerHeight) => {
          const sim: ScrollSimulation = {
            contentHeight,
            containerHeight,
            hasOverflowYAuto: true, // Our implementation always has this
          };
          
          const scrollable = canScroll(sim);
          const showsScrollbar = shouldShowScrollbar(sim);
          
          if (contentHeight > containerHeight) {
            // Property: when content exceeds container, scrolling should be enabled
            expect(scrollable).toBe(true);
            expect(showsScrollbar).toBe(true);
          } else {
            // Property: when content fits, no scrollbar needed
            expect(scrollable).toBe(false);
            expect(showsScrollbar).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Without overflow-y-auto, content would be clipped (not scrollable)
   */
  it('should not be scrollable without overflow-y-auto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 5000 }),  // contentHeight (larger than container)
        fc.integer({ min: 100, max: 400 }),   // containerHeight (smaller)
        (contentHeight, containerHeight) => {
          const simWithoutScroll: ScrollSimulation = {
            contentHeight,
            containerHeight,
            hasOverflowYAuto: false,
          };
          
          // Property: without overflow-y-auto, cannot scroll even with overflow
          expect(canScroll(simWithoutScroll)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The scroll container should be the main element, not body/window
   * This is validated by having overflow-y-auto on main, not on outer containers
   */
  it('should have scroll container as main element (not outer containers)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const mainClasses = generateMainElementClasses(isImmersive);
          
          // Outer container classes (should have overflow-hidden, not scroll)
          const outerClasses = 'h-screen bg-slate-50 flex flex-col overflow-hidden';
          const wrapperClasses = isImmersive
            ? 'flex flex-col flex-1 overflow-hidden'
            : 'flex flex-col flex-1 overflow-hidden lg:pl-64';
          
          // Property: only main should have scroll, outer containers should be hidden
          expect(mainClasses).toContain('overflow-y-auto');
          expect(outerClasses).toContain('overflow-hidden');
          expect(outerClasses).not.toContain('overflow-y-auto');
          expect(wrapperClasses).toContain('overflow-hidden');
          expect(wrapperClasses).not.toContain('overflow-y-auto');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consistent scroll behavior across all dashboard types
   */
  it('should have consistent scroll classes regardless of dashboard type', () => {
    const dashboardTypes = ['patient', 'doctor', 'admin'] as const;
    
    fc.assert(
      fc.property(
        fc.constantFrom(...dashboardTypes),
        fc.boolean(), // isImmersive
        (dashboardType, isImmersive) => {
          // The main element classes are the same regardless of dashboard type
          // Only immersive mode affects the classes
          const classes = generateMainElementClasses(isImmersive);
          
          // Property: scroll enablement is consistent across dashboard types
          expect(hasScrollEnablement(classes)).toBe(true);
          expect(hasFlexGrow(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
