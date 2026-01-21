/**
 * Property Test: Analysis Trigger Threshold
 * 
 * Feature: realtime-transcription-analysis
 * Property 1: For any transcript state change, if the transcript length increases 
 * by more than 300 characters since the last analysis, the system should queue 
 * an analysis update within the debounce window
 * 
 * Validates: Requirements 1.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';
import * as fc from 'fast-check';

describe('Property: Analysis Trigger Threshold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should trigger analysis only when transcript increases by more than 300 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random transcript updates
        fc.array(
          fc.record({
            additionalText: fc.string({ minLength: 0, maxLength: 500 }),
            shouldTrigger: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
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
          let expectedTriggers = 0;

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

          // Process each update
          for (const update of updates) {
            const previousLength = currentTranscript.length;
            currentTranscript += update.additionalText;
            const lengthDelta = currentTranscript.length - previousLength;

            // Rerender with new transcript
            rerender({ transcript: currentTranscript });

            // If length delta exceeds threshold, expect a trigger
            if (lengthDelta > 300) {
              expectedTriggers++;
            }

            // Advance timers to trigger debounce
            await vi.advanceTimersByTimeAsync(2000);
          }

          // Wait for any pending async operations
          await waitFor(() => {
            // The number of fetch calls should match expected triggers
            expect(mockFetch).toHaveBeenCalledTimes(expectedTriggers);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger analysis when transcript increases by less than 300 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate small increments (below threshold)
        fc.array(fc.string({ minLength: 1, maxLength: 299 }), { minLength: 1, maxLength: 5 }),
        async (smallIncrements) => {
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

          // Add small increments
          for (const increment of smallIncrements) {
            currentTranscript += increment;
            rerender({ transcript: currentTranscript });
            await vi.advanceTimersByTimeAsync(2000);
          }

          // Wait for any pending operations
          await waitFor(() => {
            // Should not trigger any analysis
            expect(mockFetch).not.toHaveBeenCalled();
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger analysis when cumulative small updates exceed threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 50, max: 150 }), // Size of each small increment
        fc.integer({ min: 3, max: 10 }), // Number of increments
        async (incrementSize, numIncrements) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ type: 'summary', content: 'Test analysis' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let currentTranscript = '';
          let lastAnalyzedLength = 0;
          let expectedTriggers = 0;

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

          // Add increments
          for (let i = 0; i < numIncrements; i++) {
            currentTranscript += 'x'.repeat(incrementSize);
            rerender({ transcript: currentTranscript });

            // Check if we've exceeded threshold since last analysis
            if (currentTranscript.length - lastAnalyzedLength > 300) {
              expectedTriggers++;
              lastAnalyzedLength = currentTranscript.length;
            }

            await vi.advanceTimersByTimeAsync(2000);
          }

          // Wait for pending operations
          await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(expectedTriggers);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
