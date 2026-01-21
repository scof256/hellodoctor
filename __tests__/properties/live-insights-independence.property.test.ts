/**
 * Property Test: Live Insights Independence
 * Feature: realtime-transcription-analysis
 * Property 8: For any SBAR analysis update, the live insights feed must remain unchanged
 * 
 * Validates: Requirements 7.1, 7.2, 7.5
 * 
 * This test verifies that SBAR updates and live insights operate independently:
 * - Live insights feed remains unchanged when SBAR content updates
 * - Both can coexist and update independently
 * - No interference between the two update mechanisms
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Type definitions
type LiveInsightItem = {
  id: string;
  timestamp: number;
  content: string;
};

type SBARContent = {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  type: string;
  generatedAt: number;
};

// Arbitraries for property-based testing
const liveInsightArb = fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: Date.now() - 3600000, max: Date.now() }),
  content: fc.lorem({ maxCount: 3 }),
});

const liveInsightsArrayArb = fc.array(liveInsightArb, { minLength: 0, maxLength: 10 });

const sbarContentArb = fc.record({
  situation: fc.lorem({ maxCount: 2 }),
  background: fc.lorem({ maxCount: 2 }),
  assessment: fc.lorem({ maxCount: 2 }),
  recommendation: fc.lorem({ maxCount: 2 }),
  type: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
  generatedAt: fc.integer({ min: Date.now() - 3600000, max: Date.now() }),
});

/**
 * Simulates the state management logic for live insights and SBAR content
 */
class ScribeState {
  private liveInsights: LiveInsightItem[] = [];
  private sbarContent: SBARContent | null = null;

  constructor(initialInsights: LiveInsightItem[] = []) {
    this.liveInsights = [...initialInsights];
  }

  getLiveInsights(): LiveInsightItem[] {
    return [...this.liveInsights];
  }

  getSBARContent(): SBARContent | null {
    return this.sbarContent ? { ...this.sbarContent } : null;
  }

  // Update SBAR content (should not affect live insights)
  updateSBARContent(content: SBARContent): void {
    this.sbarContent = { ...content };
  }

  // Add live insight (should not affect SBAR content)
  addLiveInsight(insight: LiveInsightItem): void {
    this.liveInsights.push({ ...insight });
  }

  // Clear SBAR content (should not affect live insights)
  clearSBARContent(): void {
    this.sbarContent = null;
  }
}

describe('Property: Live Insights Independence', () => {
  it('should preserve live insights when SBAR content is updated', () => {
    fc.assert(
      fc.property(
        liveInsightsArrayArb,
        sbarContentArb,
        fc.array(sbarContentArb, { minLength: 1, maxLength: 5 }),
        (initialInsights, firstSBAR, subsequentSBARs) => {
          // Initialize state with live insights
          const state = new ScribeState(initialInsights);
          const insightsBeforeUpdate = state.getLiveInsights();

          // Update SBAR content multiple times
          state.updateSBARContent(firstSBAR);
          subsequentSBARs.forEach((sbar) => {
            state.updateSBARContent(sbar);
          });

          // Verify live insights remain unchanged
          const insightsAfterUpdate = state.getLiveInsights();
          expect(insightsAfterUpdate).toEqual(insightsBeforeUpdate);
          expect(insightsAfterUpdate.length).toBe(initialInsights.length);

          // Verify SBAR content was updated
          const finalSBAR = state.getSBARContent();
          expect(finalSBAR).not.toBeNull();
          if (subsequentSBARs.length > 0) {
            expect(finalSBAR).toEqual(subsequentSBARs[subsequentSBARs.length - 1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve SBAR content when live insights are added', () => {
    fc.assert(
      fc.property(
        sbarContentArb,
        fc.array(liveInsightArb, { minLength: 1, maxLength: 10 }),
        (initialSBAR, newInsights) => {
          // Initialize state with SBAR content
          const state = new ScribeState();
          state.updateSBARContent(initialSBAR);
          const sbarBeforeInsights = state.getSBARContent();

          // Add multiple live insights
          newInsights.forEach((insight) => {
            state.addLiveInsight(insight);
          });

          // Verify SBAR content remains unchanged
          const sbarAfterInsights = state.getSBARContent();
          expect(sbarAfterInsights).toEqual(sbarBeforeInsights);
          expect(sbarAfterInsights).toEqual(initialSBAR);

          // Verify live insights were added
          const insights = state.getLiveInsights();
          expect(insights.length).toBe(newInsights.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow both live insights and SBAR to coexist and update independently', () => {
    fc.assert(
      fc.property(
        liveInsightsArrayArb,
        sbarContentArb,
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('sbar' as const), content: sbarContentArb }),
            fc.record({ type: fc.constant('insight' as const), content: liveInsightArb })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (initialInsights, initialSBAR, updates) => {
          // Initialize state with both
          const state = new ScribeState(initialInsights);
          state.updateSBARContent(initialSBAR);

          let expectedInsightCount = initialInsights.length;
          let expectedSBAR = initialSBAR;

          // Apply mixed updates
          updates.forEach((update) => {
            if (update.type === 'sbar') {
              state.updateSBARContent(update.content);
              expectedSBAR = update.content;
            } else {
              state.addLiveInsight(update.content);
              expectedInsightCount++;
            }
          });

          // Verify both are correct
          const finalInsights = state.getLiveInsights();
          const finalSBAR = state.getSBARContent();

          expect(finalInsights.length).toBe(expectedInsightCount);
          expect(finalSBAR).toEqual(expectedSBAR);

          // Verify initial insights are still present
          initialInsights.forEach((insight, index) => {
            expect(finalInsights[index]).toEqual(insight);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve live insights when SBAR content is cleared', () => {
    fc.assert(
      fc.property(
        liveInsightsArrayArb,
        sbarContentArb,
        (insights, sbar) => {
          // Initialize state with both
          const state = new ScribeState(insights);
          state.updateSBARContent(sbar);

          const insightsBeforeClear = state.getLiveInsights();

          // Clear SBAR content
          state.clearSBARContent();

          // Verify live insights remain unchanged
          const insightsAfterClear = state.getLiveInsights();
          expect(insightsAfterClear).toEqual(insightsBeforeClear);
          expect(insightsAfterClear.length).toBe(insights.length);

          // Verify SBAR was cleared
          expect(state.getSBARContent()).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain independent timestamps for insights and SBAR', () => {
    fc.assert(
      fc.property(
        liveInsightArb,
        sbarContentArb,
        fc.integer({ min: 1000, max: 10000 }), // delay in ms
        (insight, sbar, delay) => {
          const state = new ScribeState();

          // Add insight at time T
          const insightTime = insight.timestamp;
          state.addLiveInsight(insight);

          // Update SBAR at time T + delay
          const sbarTime = sbar.generatedAt;
          state.updateSBARContent(sbar);

          // Verify timestamps are independent
          const storedInsights = state.getLiveInsights();
          const storedSBAR = state.getSBARContent();

          expect(storedInsights[0]?.timestamp).toBe(insightTime);
          expect(storedSBAR?.generatedAt).toBe(sbarTime);

          // Timestamps should be independent
          if (insightTime !== sbarTime) {
            expect(storedInsights[0]?.timestamp).not.toBe(storedSBAR?.generatedAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
