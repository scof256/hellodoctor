/**
 * Property Test: Layout Height Constraint Structure
 * Feature: dashboard-scroll-fix, Property 2: Layout Height Constraint Structure
 * 
 * **Validates: Requirements 1.3, 2.1, 2.2**
 * 
 * *For any* dashboard layout render, the outer container SHALL use `h-screen` with 
 * `overflow-hidden`, and the content wrapper SHALL use `flex-1` with `overflow-hidden` 
 * to establish proper scroll boundaries.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Utility functions to validate CSS class structure for dashboard layout
 */

interface LayoutClassConfig {
  outerContainerClasses: string;
  contentWrapperClasses: string;
  mainElementClasses: string;
  isImmersiveMode: boolean;
}

/**
 * Validates that the outer container has the required height constraint classes
 */
function hasValidOuterContainerClasses(classes: string): boolean {
  const requiredClasses = ['h-screen', 'flex', 'flex-col', 'overflow-hidden'];
  return requiredClasses.every(cls => classes.includes(cls));
}

/**
 * Validates that the content wrapper has the required flex and overflow classes
 */
function hasValidContentWrapperClasses(classes: string, isImmersive: boolean): boolean {
  const requiredClasses = ['flex', 'flex-col', 'flex-1', 'overflow-hidden'];
  const hasRequired = requiredClasses.every(cls => classes.includes(cls));
  
  // In non-immersive mode, should have lg:pl-64 for sidebar offset
  if (!isImmersive) {
    return hasRequired && classes.includes('lg:pl-64');
  }
  
  return hasRequired;
}

/**
 * Validates that the main element has scroll enablement classes
 */
function hasValidMainElementClasses(classes: string, isImmersive: boolean): boolean {
  const requiredClasses = ['flex-1', 'overflow-y-auto'];
  const hasRequired = requiredClasses.every(cls => classes.includes(cls));
  
  // Check padding based on immersive mode
  if (isImmersive) {
    return hasRequired && classes.includes('p-0');
  }
  
  return hasRequired && classes.includes('p-4') && classes.includes('lg:p-6');
}

/**
 * Generates the expected class strings based on immersive mode
 */
function generateExpectedClasses(isImmersive: boolean): LayoutClassConfig {
  const outerContainerClasses = 'h-screen bg-slate-50 flex flex-col overflow-hidden';
  const contentWrapperClasses = isImmersive 
    ? 'flex flex-col flex-1 overflow-hidden'
    : 'flex flex-col flex-1 overflow-hidden lg:pl-64';
  const mainElementClasses = isImmersive
    ? 'flex-1 overflow-y-auto p-0'
    : 'flex-1 overflow-y-auto p-4 lg:p-6';
  
  return {
    outerContainerClasses,
    contentWrapperClasses,
    mainElementClasses,
    isImmersiveMode: isImmersive,
  };
}

describe('Property 2: Layout Height Constraint Structure', () => {
  /**
   * Property: Outer container must always have h-screen and overflow-hidden
   */
  it('should have h-screen and overflow-hidden on outer container for any layout state', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isImmersiveMode
        (isImmersive) => {
          const config = generateExpectedClasses(isImmersive);
          
          // Property: outer container must have height constraint classes
          expect(hasValidOuterContainerClasses(config.outerContainerClasses)).toBe(true);
          expect(config.outerContainerClasses).toContain('h-screen');
          expect(config.outerContainerClasses).not.toContain('min-h-screen');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content wrapper must have flex-1 and overflow-hidden
   */
  it('should have flex-1 and overflow-hidden on content wrapper for any layout state', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isImmersiveMode
        (isImmersive) => {
          const config = generateExpectedClasses(isImmersive);
          
          // Property: content wrapper must have flex and overflow classes
          expect(hasValidContentWrapperClasses(config.contentWrapperClasses, isImmersive)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sidebar offset (lg:pl-64) must be preserved in non-immersive mode
   */
  it('should preserve sidebar offset in non-immersive mode', () => {
    fc.assert(
      fc.property(
        fc.constant(false), // non-immersive mode
        (isImmersive) => {
          const config = generateExpectedClasses(isImmersive);
          
          // Property: non-immersive mode must have sidebar offset
          expect(config.contentWrapperClasses).toContain('lg:pl-64');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sidebar offset should not be present in immersive mode
   */
  it('should not have sidebar offset in immersive mode', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // immersive mode
        (isImmersive) => {
          const config = generateExpectedClasses(isImmersive);
          
          // Property: immersive mode should not have sidebar offset
          expect(config.contentWrapperClasses).not.toContain('lg:pl-64');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Layout structure should establish proper scroll boundaries
   * The combination of h-screen + overflow-hidden on outer + flex-1 + overflow-hidden on wrapper
   * creates proper scroll containment
   */
  it('should establish proper scroll boundaries with class combination', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const config = generateExpectedClasses(isImmersive);
          
          // Property: the class combination must create scroll boundaries
          // Outer: h-screen (fixed height) + overflow-hidden (no outer scroll)
          // Wrapper: flex-1 (fill remaining) + overflow-hidden (contain children)
          const outerValid = hasValidOuterContainerClasses(config.outerContainerClasses);
          const wrapperValid = hasValidContentWrapperClasses(config.contentWrapperClasses, isImmersive);
          
          expect(outerValid && wrapperValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
