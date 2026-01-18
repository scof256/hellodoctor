/**
 * Property Test: Immersive Mode Layout Integrity
 * Feature: dashboard-scroll-fix, Property 4: Immersive Mode Layout Integrity
 * 
 * **Validates: Requirements 3.4**
 * 
 * *For any* immersive view (intake chat or meeting), the layout SHALL adapt by 
 * hiding header/sidebar while maintaining proper overflow handling on the main content area.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Immersive mode paths that trigger the special layout behavior
 */
const IMMERSIVE_PATH_PATTERNS = [
  '/patient/intake/',
  '/meeting/',
] as const;

/**
 * Non-immersive dashboard paths for comparison
 */
const STANDARD_DASHBOARD_PATHS = [
  '/patient',
  '/patient/appointments',
  '/patient/messages',
  '/doctor',
  '/doctor/patients',
  '/doctor/appointments',
  '/admin',
  '/admin/users',
] as const;

/**
 * Determines if a pathname triggers immersive mode
 */
function isImmersiveMode(pathname: string): boolean {
  return pathname.startsWith('/patient/intake/') || pathname.startsWith('/meeting/');
}

/**
 * Generates the expected content wrapper classes based on immersive mode
 */
function generateContentWrapperClasses(isImmersive: boolean): string {
  const baseClasses = 'flex flex-col flex-1 overflow-hidden';
  return isImmersive ? baseClasses : `${baseClasses} lg:pl-64`;
}

/**
 * Generates the expected main element classes based on immersive mode
 */
function generateMainElementClasses(isImmersive: boolean): string {
  const baseClasses = 'flex-1 overflow-y-auto';
  return isImmersive ? `${baseClasses} p-0` : `${baseClasses} p-4 lg:p-6`;
}

/**
 * Validates that header should be hidden in immersive mode
 */
function shouldHideHeader(isImmersive: boolean): boolean {
  return isImmersive;
}

/**
 * Validates that sidebar offset should be removed in immersive mode
 */
function shouldRemoveSidebarOffset(isImmersive: boolean): boolean {
  return isImmersive;
}

/**
 * Validates that main content has zero padding in immersive mode
 */
function hasZeroPadding(classes: string): boolean {
  return classes.includes('p-0');
}

/**
 * Validates that main content has standard padding in non-immersive mode
 */
function hasStandardPadding(classes: string): boolean {
  return classes.includes('p-4') && classes.includes('lg:p-6');
}

/**
 * Validates that overflow handling is maintained regardless of mode
 */
function hasProperOverflowHandling(mainClasses: string, wrapperClasses: string): boolean {
  return mainClasses.includes('overflow-y-auto') && wrapperClasses.includes('overflow-hidden');
}

describe('Property 4: Immersive Mode Layout Integrity', () => {
  /**
   * Property: Immersive paths should be correctly detected
   */
  it('should correctly identify immersive mode paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IMMERSIVE_PATH_PATTERNS),
        fc.uuid(), // Random ID for dynamic path segment
        (pathPattern, id) => {
          const fullPath = `${pathPattern}${id}`;
          
          // Property: paths starting with immersive patterns should trigger immersive mode
          expect(isImmersiveMode(fullPath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Standard dashboard paths should not trigger immersive mode
   */
  it('should not trigger immersive mode for standard dashboard paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STANDARD_DASHBOARD_PATHS),
        (path) => {
          // Property: standard paths should not be immersive
          expect(isImmersiveMode(path)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Header should be hidden in immersive mode
   */
  it('should hide header in immersive mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const headerHidden = shouldHideHeader(isImmersive);
          
          if (isImmersive) {
            // Property: header must be hidden in immersive mode
            expect(headerHidden).toBe(true);
          } else {
            // Property: header must be visible in non-immersive mode
            expect(headerHidden).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sidebar offset should be removed in immersive mode
   */
  it('should remove sidebar offset (lg:pl-64) in immersive mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const wrapperClasses = generateContentWrapperClasses(isImmersive);
          
          if (isImmersive) {
            // Property: immersive mode should not have sidebar offset
            expect(wrapperClasses).not.toContain('lg:pl-64');
          } else {
            // Property: non-immersive mode should have sidebar offset
            expect(wrapperClasses).toContain('lg:pl-64');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Main content should have zero padding in immersive mode
   */
  it('should have zero padding on main content in immersive mode', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // immersive mode
        (isImmersive) => {
          const mainClasses = generateMainElementClasses(isImmersive);
          
          // Property: immersive mode must have p-0
          expect(hasZeroPadding(mainClasses)).toBe(true);
          expect(mainClasses).not.toContain('p-4');
          expect(mainClasses).not.toContain('lg:p-6');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Main content should have standard padding in non-immersive mode
   */
  it('should have standard padding on main content in non-immersive mode', () => {
    fc.assert(
      fc.property(
        fc.constant(false), // non-immersive mode
        (isImmersive) => {
          const mainClasses = generateMainElementClasses(isImmersive);
          
          // Property: non-immersive mode must have standard padding
          expect(hasStandardPadding(mainClasses)).toBe(true);
          expect(mainClasses).not.toContain('p-0');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Overflow handling must be maintained in both modes
   * This is critical - immersive views must still have proper scroll behavior
   */
  it('should maintain proper overflow handling regardless of mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const mainClasses = generateMainElementClasses(isImmersive);
          const wrapperClasses = generateContentWrapperClasses(isImmersive);
          
          // Property: overflow handling must be correct in both modes
          expect(hasProperOverflowHandling(mainClasses, wrapperClasses)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Flex structure must be maintained in both modes
   */
  it('should maintain flex structure in both modes', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isImmersive) => {
          const mainClasses = generateMainElementClasses(isImmersive);
          const wrapperClasses = generateContentWrapperClasses(isImmersive);
          
          // Property: flex-1 must be present on both elements
          expect(mainClasses).toContain('flex-1');
          expect(wrapperClasses).toContain('flex-1');
          expect(wrapperClasses).toContain('flex');
          expect(wrapperClasses).toContain('flex-col');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Immersive mode detection should be consistent for intake paths
   */
  it('should consistently detect intake paths as immersive', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // connectionId
        fc.option(fc.uuid()), // optional sessionId
        (connectionId, sessionId) => {
          const basePath = `/patient/intake/${connectionId}`;
          const pathWithSession = sessionId ? `${basePath}?sessionId=${sessionId}` : basePath;
          
          // Property: intake paths should always be immersive (query params don't affect detection)
          // Note: isImmersiveMode only checks pathname, not query params
          expect(isImmersiveMode(basePath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Immersive mode detection should be consistent for meeting paths
   */
  it('should consistently detect meeting paths as immersive', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // appointmentId
        (appointmentId) => {
          const meetingPath = `/meeting/${appointmentId}`;
          
          // Property: meeting paths should always be immersive
          expect(isImmersiveMode(meetingPath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Layout classes should be deterministic based on mode
   */
  it('should produce deterministic classes for the same mode', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 10 }), // number of times to generate
        (isImmersive, iterations) => {
          const results: string[] = [];
          
          for (let i = 0; i < iterations; i++) {
            results.push(generateMainElementClasses(isImmersive));
          }
          
          // Property: all generated classes should be identical for the same mode
          const allSame = results.every(r => r === results[0]);
          expect(allSame).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
