/**
 * Property-Based Tests for Progressive Content Display
 * Feature: whatsapp-simple-ux, Property 23: Progressive Content Display
 * 
 * **Validates: Requirements 15.2**
 * 
 * Property: For any page load, content should appear incrementally as it becomes
 * available rather than waiting for all content to load.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import fc from 'fast-check';
import React from 'react';
import {
  ProgressiveContent,
  useProgressiveData,
  ProgressiveList,
  AboveFold,
  BelowFold,
} from '../../app/components/ProgressiveContent';

// Test component using the hook
function TestProgressiveDataComponent({ data, chunkSize, delay }: any) {
  const { visibleData, isComplete } = useProgressiveData(data, chunkSize, delay);
  return (
    <div>
      <div data-testid="visible-count">{visibleData.length}</div>
      <div data-testid="is-complete">{isComplete.toString()}</div>
      {visibleData.map((item: any, index: number) => (
        <div key={index} data-testid={`item-${index}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

// Arbitraries for property-based testing
const priorityArb = fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<
  'high' | 'medium' | 'low'
>;

const contentArb = fc.record({
  text: fc.string({ minLength: 1, maxLength: 100 }),
  priority: priorityArb,
  delay: fc.integer({ min: 0, max: 500 }),
});

const dataArrayArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
  minLength: 1,
  maxLength: 50,
});

describe('Property: Progressive Content Display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should render high priority content immediately', () => {
    fc.assert(
      fc.property(contentArb, (content) => {
        // Force high priority
        const { container } = render(
          <ProgressiveContent priority="high">
            <div data-testid="content">{content.text}</div>
          </ProgressiveContent>
        );

        // Property: High priority content should be visible immediately
        const element = screen.queryByTestId('content');
        expect(element).toBeTruthy();
        expect(element?.textContent).toBe(content.text);
        
        // Cleanup after each property test iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should delay low priority content rendering', async () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 100, max: 500 }),
        (text, delay) => {
          const { container } = render(
            <ProgressiveContent priority="low" delay={delay}>
              <div data-testid="content">{text}</div>
            </ProgressiveContent>
          );

          // Property: Low priority content should not be visible initially
          let element = screen.queryByTestId('content');
          expect(element).toBeNull();

          // Advance timers wrapped in act
          act(() => {
            vi.advanceTimersByTime(delay);
          });

          // Property: After delay, content should be visible
          element = screen.queryByTestId('content');
          expect(element).toBeTruthy();
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show fallback while content is not rendered', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (content, fallbackText) => {
          const { container } = render(
            <ProgressiveContent
              priority="low"
              delay={300}
              fallback={<div data-testid="fallback">{fallbackText}</div>}
            >
              <div data-testid="content">{content}</div>
            </ProgressiveContent>
          );

          // Property: Fallback should be visible initially
          const fallback = screen.queryByTestId('fallback');
          expect(fallback).toBeTruthy();
          expect(fallback?.textContent).toBe(fallbackText);

          // Content should not be visible yet
          const contentElement = screen.queryByTestId('content');
          expect(contentElement).toBeNull();
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should load data progressively in chunks', () => {
    fc.assert(
      fc.property(
        dataArrayArb,
        fc.integer({ min: 1, max: 10 }),
        (data, chunkSize) => {
          const { container } = render(
            <TestProgressiveDataComponent
              data={data}
              chunkSize={chunkSize}
              delay={50}
            />
          );

          // Property: Initially, only first chunk should be visible
          const visibleCount = parseInt(
            screen.getByTestId('visible-count').textContent || '0'
          );
          const expectedInitialCount = Math.min(chunkSize, data.length);
          expect(visibleCount).toBe(expectedInitialCount);

          // Property: Should not be complete if more data exists
          const isComplete = screen.getByTestId('is-complete').textContent === 'true';
          if (data.length > chunkSize) {
            expect(isComplete).toBe(false);
          }
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should eventually show all data after progressive loading', () => {
    fc.assert(
      fc.property(
        dataArrayArb,
        fc.integer({ min: 1, max: 10 }),
        (data, chunkSize) => {
          const { container, rerender } = render(
            <TestProgressiveDataComponent
              data={data}
              chunkSize={chunkSize}
              delay={50}
            />
          );

          // Advance timers to load all chunks
          const chunksNeeded = Math.ceil(data.length / chunkSize);
          for (let i = 0; i < chunksNeeded; i++) {
            act(() => {
              vi.advanceTimersByTime(50);
            });
            rerender(
              <TestProgressiveDataComponent
                data={data}
                chunkSize={chunkSize}
                delay={50}
              />
            );
          }

          // Property: All data should be visible eventually
          const visibleCount = parseInt(
            screen.getByTestId('visible-count').textContent || '0'
          );
          expect(visibleCount).toBe(data.length);

          // Property: Should be marked as complete
          const isComplete = screen.getByTestId('is-complete').textContent === 'true';
          expect(isComplete).toBe(true);
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should render AboveFold content immediately', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (text) => {
        const { container } = render(
          <AboveFold>
            <div data-testid="above-fold">{text}</div>
          </AboveFold>
        );

        // Property: Above-fold content should be visible immediately
        const element = screen.queryByTestId('above-fold');
        expect(element).toBeTruthy();
        expect(element?.textContent).toBe(text);
        
        // Cleanup after each property test iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should defer BelowFold content rendering', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (text) => {
        const { container } = render(
          <BelowFold>
            <div data-testid="below-fold">{text}</div>
          </BelowFold>
        );

        // Property: Below-fold content should not be visible initially
        const element = screen.queryByTestId('below-fold');
        expect(element).toBeNull();
        
        // Cleanup after each property test iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should render ProgressiveList items incrementally', () => {
    fc.assert(
      fc.property(
        dataArrayArb,
        fc.integer({ min: 1, max: 10 }),
        (items, chunkSize) => {
          const { container } = render(
            <ProgressiveList
              items={items}
              renderItem={(item, index) => (
                <div data-testid={`list-item-${index}`}>{item}</div>
              )}
              chunkSize={chunkSize}
              delay={50}
            />
          );

          // Property: Initially, only first chunk of items should be rendered
          const expectedInitialCount = Math.min(chunkSize, items.length);
          for (let i = 0; i < expectedInitialCount; i++) {
            const item = screen.queryByTestId(`list-item-${i}`);
            expect(item).toBeTruthy();
          }

          // Property: Items beyond first chunk should not be rendered yet
          if (items.length > chunkSize) {
            const beyondChunk = screen.queryByTestId(`list-item-${chunkSize}`);
            expect(beyondChunk).toBeNull();
          }
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect priority ordering', () => {
    fc.assert(
      fc.property(
        fc.array(contentArb, { minLength: 2, maxLength: 5 }),
        (contents) => {
          const { container } = render(
            <div>
              {contents.map((content, index) => (
                <ProgressiveContent
                  key={index}
                  priority={content.priority}
                  delay={content.delay}
                >
                  <div data-testid={`content-${index}`}>{content.text}</div>
                </ProgressiveContent>
              ))}
            </div>
          );

          // Property: All high priority content should be visible immediately
          contents.forEach((content, index) => {
            const element = screen.queryByTestId(`content-${index}`);
            if (content.priority === 'high') {
              expect(element).toBeTruthy();
            }
          });
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty data arrays gracefully', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (chunkSize) => {
        const { container } = render(
          <TestProgressiveDataComponent data={[]} chunkSize={chunkSize} delay={50} />
        );

        // Property: Empty data should show 0 visible items
        const visibleCount = parseInt(
          screen.getByTestId('visible-count').textContent || '0'
        );
        expect(visibleCount).toBe(0);

        // Property: Should be marked as complete
        const isComplete = screen.getByTestId('is-complete').textContent === 'true';
        expect(isComplete).toBe(true);
        
        // Cleanup after each property test iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should handle single item arrays correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (item, chunkSize) => {
          const { container } = render(
            <TestProgressiveDataComponent
              data={[item]}
              chunkSize={chunkSize}
              delay={50}
            />
          );

          // Property: Single item should be visible immediately
          const visibleCount = parseInt(
            screen.getByTestId('visible-count').textContent || '0'
          );
          expect(visibleCount).toBe(1);

          // Property: Should be marked as complete
          const isComplete = screen.getByTestId('is-complete').textContent === 'true';
          expect(isComplete).toBe(true);
          
          // Cleanup after each property test iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
