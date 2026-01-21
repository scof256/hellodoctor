/**
 * Property Test: Debounce Consistency
 * 
 * Feature: realtime-transcription-analysis
 * Property 2: For any sequence of rapid transcript updates, the system should 
 * trigger at most one analysis request per debounce period (2 seconds), 
 * preventing API flooding
 * 
 * Validates: Requirements 1.3, 5.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';
import * as fc from 'fast-check';

describe('Property: Debounce Consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should trigger at most one analysis per 2-second debounce period', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate rapid sequences of transcript updates
        fc.array(
          fc.record({
            text: fc.string({ minLength: 301, maxLength: 500 }), // Always above threshold
            delayMs: fc.integer({ min: 0, max: 1500 }), // Delays within debounce window
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (updates) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ type: 'summary', content: 'Test analysis' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let currentTranscript = '';

          const { rerender, unmount } = renderHook(
            ({ transcript }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: 'summary',
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript: currentTranscript } }
          );

          let totalElapsedTime = 0;
          let expectedTriggers = 0;
          let timeSinceLastTrigger = 0;

          // Process rapid updates
          for (const update of updates) {
            currentTranscript += update.text;
            rerender({ transcript: currentTranscript });

            // Advance by the delay
            await vi.advanceTimersByTimeAsync(update.delayMs);
            totalElapsedTime += update.delayMs;
            timeSinceLastTrigger += update.delayMs;
          }

          // Advance to complete the final debounce period
          await vi.advanceTimersByTimeAsync(2000);
          totalElapsedTime += 2000;

          // Calculate expected triggers: one per 2-second period
          // Since all updates are above threshold, we expect triggers based on debounce periods
          expectedTriggers = Math.floor(totalElapsedTime / 2000);
          if (expectedTriggers === 0 && updates.length > 0) {
            expectedTriggers = 1; // At least one trigger if there were updates
          }

          // The actual number of triggers should not exceed expected
          expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(expectedTriggers + 1);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset debounce timer on each new update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 8 }), // Number of rapid updates
        async (numUpdates) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ type: 'summary', content: 'Test analysis' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let currentTranscript = '';

          const { rerender, unmount } = renderHook(
            ({ transcript }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: 'summary',
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript: currentTranscript } }
          );

          // Send rapid updates every 1 second (within debounce window)
          for (let i = 0; i < numUpdates; i++) {
            currentTranscript += 'x'.repeat(350); // Above threshold
            rerender({ transcript: currentTranscript });
            await vi.advanceTimersByTimeAsync(1000); // Less than debounce delay
          }

          // At this point, no analysis should have triggered yet
          expect(mockFetch).not.toHaveBeenCalled();

          // Now wait for the full debounce period
          await vi.advanceTimersByTimeAsync(2000);

          // Should trigger exactly once
          expect(mockFetch).toHaveBeenCalledTimes(1);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow multiple triggers if updates are spaced beyond debounce period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of well-spaced updates
        async (numUpdates) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ type: 'summary', content: 'Test analysis' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let currentTranscript = '';

          const { rerender, unmount } = renderHook(
            ({ transcript }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: 'summary',
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript: currentTranscript } }
          );

          // Send updates spaced 3 seconds apart (beyond debounce)
          for (let i = 0; i < numUpdates; i++) {
            currentTranscript += 'x'.repeat(350); // Above threshold
            rerender({ transcript: currentTranscript });
            await vi.advanceTimersByTimeAsync(3000); // Beyond debounce delay
          }

          // Should trigger once per update
          expect(mockFetch).toHaveBeenCalledTimes(numUpdates);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
