/**
 * Property Test: Manual Override Immediacy
 * Feature: realtime-transcription-analysis, Property 6
 * 
 * Validates: Requirements 6.1
 * 
 * Property: For any manual analysis button click, the system must immediately 
 * trigger analysis regardless of debounce timing or recent update history.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';
import * as fc from 'fast-check';

// Mock the SBAR extractor
vi.mock('@/app/lib/sbar-extractor', () => ({
  extractSBARContent: vi.fn((content: string, type: string) => ({
    situation: 'Test situation',
    background: 'Test background',
    assessment: 'Test assessment',
    recommendation: 'Test recommendation',
    type,
    generatedAt: Date.now(),
  })),
}));

describe('Property: Manual Override Immediacy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should immediately trigger analysis on manual override regardless of debounce state', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random timing scenarios
        fc.record({
          // Time elapsed since last auto-trigger (0-5000ms)
          timeSinceLastTrigger: fc.integer({ min: 0, max: 5000 }),
          // Whether there's a pending debounced request
          hasPendingDebounce: fc.boolean(),
          // Number of rapid transcript updates before manual click
          rapidUpdates: fc.integer({ min: 0, max: 10 }),
          // Analysis type
          analysisType: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
        }),
        async (scenario) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: 'Test analysis content' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let transcript = 'Initial transcript. ';

          const { result, rerender } = renderHook(
            (props) => useRealTimeAnalysis(props),
            {
              initialProps: {
                fullTranscript: transcript,
                activeAnalysisType: scenario.analysisType as any,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              },
            }
          );

          // Simulate rapid updates if specified
          if (scenario.rapidUpdates > 0) {
            for (let i = 0; i < scenario.rapidUpdates; i++) {
              transcript += 'Additional text to exceed threshold. '.repeat(10);
              rerender({
                fullTranscript: transcript,
                activeAnalysisType: scenario.analysisType as any,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              });
              
              // Advance time slightly but not enough to trigger debounce
              vi.advanceTimersByTime(500);
            }
          }

          // If there should be a pending debounce, advance time partially
          if (scenario.hasPendingDebounce) {
            transcript += 'More text to trigger debounce. '.repeat(10);
            rerender({
              fullTranscript: transcript,
              activeAnalysisType: scenario.analysisType as any,
              appointmentId: 'test-appointment-id',
              scribeIsActive: true,
              onAnalysisStart,
              onAnalysisComplete,
              onAnalysisError,
            });
            
            // Advance time but not enough to complete debounce (less than 2000ms)
            vi.advanceTimersByTime(1000);
          }

          // Record fetch call count before manual trigger
          const fetchCallsBeforeManual = mockFetch.mock.calls.length;

          // Trigger manual analysis
          result.current.triggerManualAnalysis();

          // Flush pending promises
          await vi.runAllTimersAsync();

          // Property 1: Manual trigger should call fetch immediately (synchronously)
          // without waiting for debounce timer
          expect(mockFetch).toHaveBeenCalledTimes(fetchCallsBeforeManual + 1);

          // Property 2: The fetch should be called with correct parameters
          const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
          expect(lastCall[0]).toBe('/api/transcribe/analyze');
          expect(lastCall[1]).toMatchObject({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const body = JSON.parse(lastCall[1].body);
          expect(body).toMatchObject({
            appointmentId: 'test-appointment-id',
            type: scenario.analysisType,
          });

          // Property 3: onAnalysisStart should be called immediately
          expect(onAnalysisStart).toHaveBeenCalled();

          // Property 4: onAnalysisComplete should be called
          expect(onAnalysisComplete).toHaveBeenCalled();

          // Property 5: If there was a pending debounce, advancing time further
          // should NOT trigger another analysis (debounce was cancelled)
          if (scenario.hasPendingDebounce) {
            const fetchCallsAfterManual = mockFetch.mock.calls.length;
            
            // Advance past the original debounce time
            vi.advanceTimersByTime(2000);
            
            // Should not have triggered another fetch
            expect(mockFetch).toHaveBeenCalledTimes(fetchCallsAfterManual);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should cancel pending debounced requests when manual override is triggered', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Time to wait before manual trigger (0-1900ms, less than debounce)
          waitTime: fc.integer({ min: 0, max: 1900 }),
          analysisType: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
        }),
        async (scenario) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: 'Test analysis content' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let transcript = 'Initial transcript. ';

          const { result, rerender } = renderHook(
            (props) => useRealTimeAnalysis(props),
            {
              initialProps: {
                fullTranscript: transcript,
                activeAnalysisType: scenario.analysisType as any,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              },
            }
          );

          // Trigger auto-analysis by exceeding threshold
          transcript += 'Additional text to exceed threshold. '.repeat(10);
          rerender({
            fullTranscript: transcript,
            activeAnalysisType: scenario.analysisType as any,
            appointmentId: 'test-appointment-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          });

          // Wait partially through debounce period
          vi.advanceTimersByTime(scenario.waitTime);

          // At this point, no fetch should have been called yet (still debouncing)
          expect(mockFetch).not.toHaveBeenCalled();

          // Trigger manual override
          result.current.triggerManualAnalysis();

          // Flush pending promises
          await vi.runAllTimersAsync();

          // Manual trigger should call fetch immediately
          expect(mockFetch).toHaveBeenCalledTimes(1);

          // onAnalysisComplete should be called
          expect(onAnalysisComplete).toHaveBeenCalled();

          // Advance time past the original debounce period
          vi.advanceTimersByTime(2000);

          // Should still only have 1 fetch call (debounce was cancelled)
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should work correctly regardless of recent update history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Number of previous auto-analyses
          previousAnalyses: fc.integer({ min: 0, max: 5 }),
          // Time since last completed analysis (0-10000ms)
          timeSinceLastAnalysis: fc.integer({ min: 0, max: 10000 }),
          analysisType: fc.constantFrom('summary', 'soap', 'action_items', 'risk_assessment'),
        }),
        async (scenario) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: 'Test analysis content' }),
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let transcript = 'Initial transcript. ';

          const { result, rerender } = renderHook(
            (props) => useRealTimeAnalysis(props),
            {
              initialProps: {
                fullTranscript: transcript,
                activeAnalysisType: scenario.analysisType as any,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              },
            }
          );

          // Simulate previous analyses
          for (let i = 0; i < scenario.previousAnalyses; i++) {
            transcript += 'Additional text to exceed threshold. '.repeat(10);
            rerender({
              fullTranscript: transcript,
              activeAnalysisType: scenario.analysisType as any,
              appointmentId: 'test-appointment-id',
              scribeIsActive: true,
              onAnalysisStart,
              onAnalysisComplete,
              onAnalysisError,
            });

            // Complete the debounce
            await vi.runAllTimersAsync();

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalledTimes(i + 1);
          }

          // Advance time since last analysis
          vi.advanceTimersByTime(scenario.timeSinceLastAnalysis);

          // Record fetch count before manual trigger
          const fetchCountBefore = mockFetch.mock.calls.length;

          // Trigger manual analysis
          result.current.triggerManualAnalysis();

          // Flush pending promises
          await vi.runAllTimersAsync();

          // Should trigger immediately regardless of history
          expect(mockFetch).toHaveBeenCalledTimes(fetchCountBefore + 1);

          // onAnalysisComplete should be called
          expect(onAnalysisComplete).toHaveBeenCalledTimes(scenario.previousAnalyses + 1);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
