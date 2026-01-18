/**
 * Property Test: Scroll Position Preservation
 * Feature: site-performance-optimization, Property 10: Scroll Position Preservation
 * 
 * **Validates: Requirements 7.4**
 * 
 * *For any* virtual scroll list, when new items are loaded at the top,
 * the visible content SHALL remain at the same scroll position relative
 * to the previously visible items.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculatePreservedScrollPosition,
  isScrollPositionPreserved,
  calculateVisibleRange,
} from '../../app/components/VirtualMessageList';

describe('Property 10: Scroll Position Preservation', () => {
  /**
   * Property: Scroll position adjustment should equal new items * item height
   */
  it('should calculate preserved scroll position correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // Current scroll position
        fc.integer({ min: 1, max: 100 }),   // Number of new items prepended
        fc.integer({ min: 40, max: 200 }),  // Item height
        (currentScrollTop, newItemsCount, itemHeight) => {
          const newScrollTop = calculatePreservedScrollPosition(
            currentScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Property: new scroll position should be offset by exactly newItemsCount * itemHeight
          const expectedOffset = newItemsCount * itemHeight;
          expect(newScrollTop).toBe(currentScrollTop + expectedOffset);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isScrollPositionPreserved should return true for correct adjustments
   */
  it('should correctly identify preserved scroll positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 40, max: 200 }),
        (originalScrollTop, newItemsCount, itemHeight) => {
          // Calculate the correct new scroll position
          const correctNewScrollTop = calculatePreservedScrollPosition(
            originalScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Property: should return true for correctly preserved position
          expect(
            isScrollPositionPreserved(
              originalScrollTop,
              correctNewScrollTop,
              newItemsCount,
              itemHeight
            )
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isScrollPositionPreserved should return false for incorrect adjustments
   */
  it('should detect when scroll position is not preserved', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 40, max: 200 }),
        fc.integer({ min: 10, max: 1000 }), // Error amount (must be > tolerance)
        (originalScrollTop, newItemsCount, itemHeight, errorAmount) => {
          // Calculate the correct new scroll position
          const correctNewScrollTop = calculatePreservedScrollPosition(
            originalScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Add error to make it incorrect
          const incorrectNewScrollTop = correctNewScrollTop + errorAmount;
          
          // Property: should return false for incorrectly preserved position
          expect(
            isScrollPositionPreserved(
              originalScrollTop,
              incorrectNewScrollTop,
              newItemsCount,
              itemHeight,
              1 // tolerance
            )
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Visible items should remain the same after scroll adjustment
   */
  it('should keep same items visible after prepending and adjusting scroll', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }), // Initial message count
        fc.integer({ min: 1, max: 50 }),     // New items prepended
        fc.integer({ min: 300, max: 600 }),  // Container height
        fc.integer({ min: 60, max: 100 }),   // Item height
        fc.integer({ min: 5, max: 15 }),     // Buffer size
        (initialCount, newItemsCount, containerHeight, itemHeight, bufferSize) => {
          // Calculate initial scroll position (somewhere in the middle)
          const middleIndex = Math.floor(initialCount / 2);
          const initialScrollTop = middleIndex * itemHeight;
          
          // Get visible range before prepending
          const beforeRange = calculateVisibleRange(
            initialScrollTop,
            containerHeight,
            itemHeight,
            initialCount,
            bufferSize
          );
          
          // Calculate new scroll position after prepending
          const newScrollTop = calculatePreservedScrollPosition(
            initialScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Get visible range after prepending (with adjusted scroll)
          const newTotalCount = initialCount + newItemsCount;
          const afterRange = calculateVisibleRange(
            newScrollTop,
            containerHeight,
            itemHeight,
            newTotalCount,
            bufferSize
          );
          
          // Property: The visible indices should be shifted by newItemsCount
          // (since new items were prepended, old item at index i is now at index i + newItemsCount)
          expect(afterRange.startIndex).toBe(beforeRange.startIndex + newItemsCount);
          expect(afterRange.endIndex).toBe(beforeRange.endIndex + newItemsCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Scroll position preservation should be idempotent
   * Applying the same adjustment twice should not be the same as applying once
   */
  it('should not be idempotent - each prepend requires its own adjustment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 40, max: 200 }),
        (originalScrollTop, newItemsCount, itemHeight) => {
          // Apply adjustment once
          const afterOneAdjustment = calculatePreservedScrollPosition(
            originalScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Apply adjustment twice (simulating two prepends)
          const afterTwoAdjustments = calculatePreservedScrollPosition(
            afterOneAdjustment,
            newItemsCount,
            itemHeight
          );
          
          // Property: Two adjustments should result in double the offset
          const expectedAfterTwo = originalScrollTop + (2 * newItemsCount * itemHeight);
          expect(afterTwoAdjustments).toBe(expectedAfterTwo);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Zero new items should not change scroll position
   */
  it('should not change scroll position when no items are prepended', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 40, max: 200 }),
        (originalScrollTop, itemHeight) => {
          const newScrollTop = calculatePreservedScrollPosition(
            originalScrollTop,
            0, // No new items
            itemHeight
          );
          
          // Property: scroll position should remain unchanged
          expect(newScrollTop).toBe(originalScrollTop);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tolerance should work correctly in isScrollPositionPreserved
   */
  it('should respect tolerance parameter in scroll position check', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 40, max: 200 }),
        fc.integer({ min: 1, max: 10 }), // Tolerance
        (originalScrollTop, newItemsCount, itemHeight, tolerance) => {
          const correctNewScrollTop = calculatePreservedScrollPosition(
            originalScrollTop,
            newItemsCount,
            itemHeight
          );
          
          // Test with error within tolerance
          const withinTolerance = correctNewScrollTop + tolerance;
          expect(
            isScrollPositionPreserved(
              originalScrollTop,
              withinTolerance,
              newItemsCount,
              itemHeight,
              tolerance
            )
          ).toBe(true);
          
          // Test with error just outside tolerance
          const outsideTolerance = correctNewScrollTop + tolerance + 2;
          expect(
            isScrollPositionPreserved(
              originalScrollTop,
              outsideTolerance,
              newItemsCount,
              itemHeight,
              tolerance
            )
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
