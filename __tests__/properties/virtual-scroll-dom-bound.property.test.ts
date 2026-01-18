/**
 * Property Test: Virtual Scrolling DOM Bound
 * Feature: site-performance-optimization, Property 9: Virtual Scrolling DOM Bound
 * 
 * **Validates: Requirements 7.1**
 * 
 * *For any* message list of size N where N > 50, the number of rendered DOM nodes
 * SHALL be bounded by (viewport height / item height) + (2 * buffer size),
 * regardless of N.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateVisibleRange,
  getRenderedItemCount,
} from '../../app/components/VirtualMessageList';

describe('Property 9: Virtual Scrolling DOM Bound', () => {
  /**
   * Property: For any message list size N > 50, rendered items are bounded
   * The bound is: ceil(containerHeight / itemHeight) + 2 * bufferSize + 1
   * The +1 accounts for partial items at scroll boundaries
   */
  it('should bound rendered items regardless of total message count', () => {
    fc.assert(
      fc.property(
        // Generate message count > 50 (threshold for virtual scrolling)
        fc.integer({ min: 51, max: 10000 }),
        // Generate container height (viewport)
        fc.integer({ min: 200, max: 1000 }),
        // Generate item height
        fc.integer({ min: 40, max: 200 }),
        // Generate buffer size
        fc.integer({ min: 5, max: 20 }),
        // Generate scroll position
        fc.integer({ min: 0, max: 100000 }),
        (totalMessages, containerHeight, itemHeight, bufferSize, scrollTop) => {
          // Clamp scroll position to valid range
          const maxScroll = Math.max(0, totalMessages * itemHeight - containerHeight);
          const clampedScrollTop = Math.min(scrollTop, maxScroll);
          
          // Calculate visible range
          const { startIndex, endIndex } = calculateVisibleRange(
            clampedScrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          // Calculate actual rendered count
          const renderedCount = endIndex - startIndex + 1;
          
          // Calculate expected maximum bound
          // The bound includes: visible items + buffer above + buffer below + 1 for partial items
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          const maxBound = visibleCount + (2 * bufferSize) + 1;
          
          // Property: rendered count should be bounded
          expect(renderedCount).toBeLessThanOrEqual(maxBound);
          
          // Property: rendered count should be much smaller than total messages
          // for large lists (the whole point of virtual scrolling)
          if (totalMessages > 100) {
            expect(renderedCount).toBeLessThan(totalMessages);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rendered items should always include visible viewport items
   */
  it('should always include items visible in the viewport', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 5000 }),
        fc.integer({ min: 200, max: 800 }),
        fc.integer({ min: 50, max: 150 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Generate a random scroll position
          const maxScroll = Math.max(0, totalMessages * itemHeight - containerHeight);
          const scrollTop = Math.floor(Math.random() * maxScroll);
          
          const { startIndex, endIndex } = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          // Calculate which items are actually visible (without buffer)
          const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          const lastVisibleIndex = Math.min(
            totalMessages - 1,
            firstVisibleIndex + visibleCount - 1
          );
          
          // Property: all visible items should be included in rendered range
          expect(startIndex).toBeLessThanOrEqual(firstVisibleIndex);
          expect(endIndex).toBeGreaterThanOrEqual(lastVisibleIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffer zones should be applied correctly when not at edges
   */
  it('should include buffer items above and below viewport when in middle of list', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 1000 }), // Need enough messages for middle position
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Position in the middle of the list (not at edges)
          const middleIndex = Math.floor(totalMessages / 2);
          const middlePosition = middleIndex * itemHeight;
          
          // Ensure we're not at the edges
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          if (middleIndex < bufferSize + visibleCount || 
              middleIndex + visibleCount + bufferSize >= totalMessages) {
            return; // Skip edge cases
          }
          
          const { startIndex, endIndex } = calculateVisibleRange(
            middlePosition,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          const firstVisibleIndex = Math.floor(middlePosition / itemHeight);
          
          // Property: buffer should extend above visible area
          expect(startIndex).toBeLessThanOrEqual(firstVisibleIndex - bufferSize);
          
          // Property: buffer should extend below visible area
          expect(endIndex).toBeGreaterThanOrEqual(
            Math.min(totalMessages - 1, firstVisibleIndex + visibleCount + bufferSize - 1)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Start and end indices should always be valid for virtual scroll scenarios
   * Virtual scrolling is only used when messages > 50 (VIRTUAL_SCROLL_THRESHOLD)
   */
  it('should always produce valid index ranges for virtual scroll scenarios', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 10000 }), // Virtual scroll threshold is 50
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 20, max: 200 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 1000000 }),
        (totalMessages, containerHeight, itemHeight, bufferSize, scrollTop) => {
          // Clamp scroll position to valid range
          const maxScroll = Math.max(0, totalMessages * itemHeight - containerHeight);
          const clampedScrollTop = Math.min(scrollTop, maxScroll);
          
          const { startIndex, endIndex } = calculateVisibleRange(
            clampedScrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          // Property: startIndex should be >= 0
          expect(startIndex).toBeGreaterThanOrEqual(0);
          
          // Property: endIndex should be < totalMessages
          expect(endIndex).toBeLessThan(totalMessages);
          
          // Property: startIndex should be <= endIndex
          expect(startIndex).toBeLessThanOrEqual(endIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: DOM bound should scale with viewport, not message count
   * For large lists in the middle, rendered count should be consistent
   */
  it('should have consistent DOM bound for different message counts when in middle', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (containerHeight, itemHeight, bufferSize) => {
          // Test with different message counts, both large enough to be in middle
          const smallList = 500;
          const largeList = 5000;
          
          // Calculate for small list (middle position)
          const smallMiddle = Math.floor(smallList / 2);
          const smallScrollTop = smallMiddle * itemHeight;
          const smallRange = calculateVisibleRange(
            smallScrollTop,
            containerHeight,
            itemHeight,
            smallList,
            bufferSize
          );
          const smallRendered = smallRange.endIndex - smallRange.startIndex + 1;
          
          // Calculate for large list (middle position)
          const largeMiddle = Math.floor(largeList / 2);
          const largeScrollTop = largeMiddle * itemHeight;
          const largeRange = calculateVisibleRange(
            largeScrollTop,
            containerHeight,
            itemHeight,
            largeList,
            bufferSize
          );
          const largeRendered = largeRange.endIndex - largeRange.startIndex + 1;
          
          // Property: both should render the same number of items when in middle
          expect(smallRendered).toBe(largeRendered);
          
          // Property: rendered count should be bounded
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          const maxBound = visibleCount + (2 * bufferSize) + 1;
          expect(smallRendered).toBeLessThanOrEqual(maxBound);
          expect(largeRendered).toBeLessThanOrEqual(maxBound);
        }
      ),
      { numRuns: 100 }
    );
  });
});
