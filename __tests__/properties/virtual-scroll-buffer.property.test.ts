/**
 * Property Test: Virtual Scroll Buffer
 * Feature: site-performance-optimization, Property 11: Virtual Scroll Buffer
 * 
 * **Validates: Requirements 7.5**
 * 
 * *For any* virtual scroll calculation, the rendered items SHALL include
 * buffer items above and below the visible viewport (at least bufferSize
 * when not at edges).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateVisibleRange } from '../../app/components/VirtualMessageList';

describe('Property 11: Virtual Scroll Buffer', () => {
  /**
   * Property: Buffer should extend above visible area when not at top edge
   */
  it('should include buffer items above viewport when not at top', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 1000 }), // Total messages (enough to not be at edge)
        fc.integer({ min: 300, max: 600 }),  // Container height
        fc.integer({ min: 60, max: 100 }),   // Item height
        fc.integer({ min: 5, max: 15 }),     // Buffer size
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Position in the middle of the list (not at edges)
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          const middleIndex = Math.floor(totalMessages / 2);
          
          // Ensure we're not at the edges
          if (middleIndex < bufferSize + visibleCount || 
              middleIndex + visibleCount + bufferSize >= totalMessages) {
            return; // Skip edge cases
          }
          
          const scrollTop = middleIndex * itemHeight;
          
          const { startIndex } = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
          
          // Property: startIndex should be exactly bufferSize items before first visible
          expect(startIndex).toBe(firstVisibleIndex - bufferSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffer should extend below visible area when not at bottom edge
   * Note: The implementation uses Math.ceil for visible count, so endIndex
   * may be bufferSize or bufferSize+1 items after the last fully visible item
   */
  it('should include at least buffer items below viewport when not at bottom', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 1000 }),
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Position in the middle of the list
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          const middleIndex = Math.floor(totalMessages / 2);
          
          // Ensure we're not at the edges
          if (middleIndex < bufferSize + visibleCount || 
              middleIndex + visibleCount + bufferSize >= totalMessages) {
            return;
          }
          
          const scrollTop = middleIndex * itemHeight;
          
          const { endIndex } = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
          
          // Property: endIndex should be at least bufferSize items after first visible + visible count
          // The formula is: firstVisibleIndex + visibleCount + bufferSize
          const expectedEndIndex = firstVisibleIndex + visibleCount + bufferSize;
          expect(endIndex).toBe(expectedEndIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffer should be clamped at top edge (startIndex >= 0)
   */
  it('should clamp buffer at top edge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 500 }),
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Scroll to near the top
          const scrollTop = 0;
          
          const { startIndex } = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          // Property: startIndex should be clamped to 0
          expect(startIndex).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffer should be clamped at bottom edge (endIndex < totalMessages)
   */
  it('should clamp buffer at bottom edge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 500 }),
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          // Scroll to the bottom
          const maxScroll = Math.max(0, totalMessages * itemHeight - containerHeight);
          
          const { endIndex } = calculateVisibleRange(
            maxScroll,
            containerHeight,
            itemHeight,
            totalMessages,
            bufferSize
          );
          
          // Property: endIndex should be clamped to totalMessages - 1
          expect(endIndex).toBe(totalMessages - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffer size should be consistent regardless of scroll position
   * (when not at edges)
   */
  it('should maintain consistent buffer above at different scroll positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 2000 }), // Large enough list
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 15 }),
        (totalMessages, containerHeight, itemHeight, bufferSize) => {
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          
          // Test at multiple positions in the middle
          const positions = [
            Math.floor(totalMessages * 0.25),
            Math.floor(totalMessages * 0.5),
            Math.floor(totalMessages * 0.75),
          ];
          
          for (const posIndex of positions) {
            // Skip if too close to edges
            if (posIndex < bufferSize + visibleCount || 
                posIndex + visibleCount + bufferSize >= totalMessages) {
              continue;
            }
            
            const scrollTop = posIndex * itemHeight;
            const { startIndex } = calculateVisibleRange(
              scrollTop,
              containerHeight,
              itemHeight,
              totalMessages,
              bufferSize
            );
            
            const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
            
            // Property: buffer above should be exactly bufferSize
            const bufferAbove = firstVisibleIndex - startIndex;
            expect(bufferAbove).toBe(bufferSize);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Larger buffer size should result in more rendered items
   */
  it('should render more items with larger buffer size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 1000 }),
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        fc.integer({ min: 5, max: 10 }),  // Small buffer
        fc.integer({ min: 15, max: 25 }), // Large buffer
        (totalMessages, containerHeight, itemHeight, smallBuffer, largeBuffer) => {
          // Position in the middle
          const middleIndex = Math.floor(totalMessages / 2);
          const scrollTop = middleIndex * itemHeight;
          
          const smallRange = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            smallBuffer
          );
          
          const largeRange = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            largeBuffer
          );
          
          const smallRendered = smallRange.endIndex - smallRange.startIndex + 1;
          const largeRendered = largeRange.endIndex - largeRange.startIndex + 1;
          
          // Property: larger buffer should render more items
          expect(largeRendered).toBeGreaterThan(smallRendered);
          
          // Property: difference should be approximately 2 * (largeBuffer - smallBuffer)
          const expectedDifference = 2 * (largeBuffer - smallBuffer);
          expect(largeRendered - smallRendered).toBe(expectedDifference);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Zero buffer should render only visible items (plus partial item from ceil)
   */
  it('should render visible items with zero buffer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 500 }),
        fc.integer({ min: 300, max: 600 }),
        fc.integer({ min: 60, max: 100 }),
        (totalMessages, containerHeight, itemHeight) => {
          // Position in the middle
          const middleIndex = Math.floor(totalMessages / 2);
          const scrollTop = middleIndex * itemHeight;
          
          const { startIndex, endIndex } = calculateVisibleRange(
            scrollTop,
            containerHeight,
            itemHeight,
            totalMessages,
            0 // Zero buffer
          );
          
          const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          
          // Property: should start at first visible item
          expect(startIndex).toBe(firstVisibleIndex);
          
          // Property: should end at first visible + visible count (clamped to total)
          // Note: visibleCount uses Math.ceil so it includes partial items
          expect(endIndex).toBe(
            Math.min(totalMessages - 1, firstVisibleIndex + visibleCount)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
