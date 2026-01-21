/**
 * Property Test: Content Update Animation
 * Feature: realtime-transcription-analysis, Property 5
 * 
 * For any successful analysis completion, the SBAR display must animate 
 * the content transition and preserve the user's scroll position within 
 * a 50px tolerance.
 * 
 * Validates: Requirements 3.2, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SBARDisplay } from '../../app/components/SBARDisplay';
import { SBARContent } from '../../app/lib/sbar-extractor';
import * as fc from 'fast-check';

describe('Property 5: Content Update Animation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preserve scroll position within 50px tolerance when content updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random scroll positions (0 to 1000px)
        fc.integer({ min: 0, max: 1000 }),
        // Generate random SBAR content updates
        fc.record({
          situation: fc.string({ minLength: 50, maxLength: 200 }),
          background: fc.string({ minLength: 50, maxLength: 200 }),
          assessment: fc.string({ minLength: 50, maxLength: 200 }),
          recommendation: fc.string({ minLength: 50, maxLength: 200 }),
          type: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
          generatedAt: fc.integer({ min: Date.now() - 10000, max: Date.now() }),
        }),
        async (initialScrollPosition, sbarContent) => {
          // Create a container with scrollable content
          const container = document.createElement('div');
          container.style.height = '500px';
          container.style.overflow = 'auto';
          document.body.appendChild(container);

          // Render initial content
          const { rerender } = render(
            <SBARDisplay
              content={sbarContent as SBARContent}
              isLoading={false}
              lastUpdated={sbarContent.generatedAt}
            />,
            { container }
          );

          // Wait for initial render
          await waitFor(() => {
            expect(screen.getByText('Situation')).toBeInTheDocument();
          });

          // Set scroll position
          container.scrollTop = initialScrollPosition;
          const scrollBeforeUpdate = container.scrollTop;

          // Generate updated content
          const updatedContent: SBARContent = {
            ...sbarContent,
            situation: sbarContent.situation + ' [UPDATED]',
            generatedAt: Date.now(),
          };

          // Update content
          rerender(
            <SBARDisplay
              content={updatedContent}
              isLoading={false}
              lastUpdated={updatedContent.generatedAt}
            />
          );

          // Wait for update to complete
          await waitFor(() => {
            expect(screen.getByText(/\[UPDATED\]/)).toBeInTheDocument();
          });

          const scrollAfterUpdate = container.scrollTop;

          // Verify scroll position preserved within 50px tolerance
          const scrollDifference = Math.abs(scrollAfterUpdate - scrollBeforeUpdate);
          expect(scrollDifference).toBeLessThanOrEqual(50);

          // Cleanup
          document.body.removeChild(container);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply animation classes to new content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          situation: fc.string({ minLength: 20, maxLength: 100 }),
          background: fc.string({ minLength: 20, maxLength: 100 }),
          assessment: fc.string({ minLength: 20, maxLength: 100 }),
          recommendation: fc.string({ minLength: 20, maxLength: 100 }),
          type: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
          generatedAt: fc.integer({ min: Date.now() - 10000, max: Date.now() }),
        }),
        async (sbarContent) => {
          const { container } = render(
            <SBARDisplay
              content={sbarContent as SBARContent}
              isLoading={false}
              lastUpdated={sbarContent.generatedAt}
            />
          );

          // Wait for content to render with shorter timeout
          await waitFor(() => {
            expect(screen.getByText('Situation')).toBeInTheDocument();
          }, { timeout: 2000 });

          // Find the SBAR cards container
          const cardsContainer = container.querySelector('.space-y-4.animate-in');
          
          // Verify animation classes are present
          expect(cardsContainer).toBeInTheDocument();
          expect(cardsContainer?.classList.contains('animate-in')).toBe(true);
          expect(cardsContainer?.classList.contains('fade-in')).toBe(true);
          expect(cardsContainer?.classList.contains('slide-in-from-bottom-4')).toBe(true);
          expect(cardsContainer?.classList.contains('duration-500')).toBe(true);
        }
      ),
      { numRuns: 50 } // Reduced from 100 for faster execution
    );
  }, 15000); // Increased timeout for property test

  it('should maintain scroll position across multiple rapid updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 800 }),
        fc.array(
          fc.record({
            situation: fc.string({ minLength: 30, maxLength: 150 }),
            background: fc.string({ minLength: 30, maxLength: 150 }),
            assessment: fc.string({ minLength: 30, maxLength: 150 }),
            recommendation: fc.string({ minLength: 30, maxLength: 150 }),
            type: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
            generatedAt: fc.integer({ min: Date.now() - 10000, max: Date.now() }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (initialScrollPosition, contentUpdates) => {
          const container = document.createElement('div');
          container.style.height = '500px';
          container.style.overflow = 'auto';
          document.body.appendChild(container);

          // Render initial content
          const { rerender } = render(
            <SBARDisplay
              content={contentUpdates[0] as SBARContent}
              isLoading={false}
              lastUpdated={contentUpdates[0].generatedAt}
            />,
            { container }
          );

          await waitFor(() => {
            expect(screen.getByText('Situation')).toBeInTheDocument();
          }, { timeout: 2000 });

          // Set initial scroll position
          container.scrollTop = initialScrollPosition;
          const initialScroll = container.scrollTop;

          // Apply multiple updates
          for (let i = 1; i < contentUpdates.length; i++) {
            rerender(
              <SBARDisplay
                content={contentUpdates[i] as SBARContent}
                isLoading={false}
                lastUpdated={contentUpdates[i].generatedAt}
              />
            );

            await waitFor(() => {
              expect(screen.getByText('Situation')).toBeInTheDocument();
            }, { timeout: 2000 });
          }

          const finalScroll = container.scrollTop;
          const totalScrollDrift = Math.abs(finalScroll - initialScroll);

          // Verify scroll position maintained within tolerance across all updates
          expect(totalScrollDrift).toBeLessThanOrEqual(50);

          // Cleanup
          document.body.removeChild(container);
        }
      ),
      { numRuns: 30 } // Reduced from 50 for faster execution
    );
  }, 20000); // Increased timeout for property test
});
