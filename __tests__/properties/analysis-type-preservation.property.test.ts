/**
 * Property Test: Analysis Type Preservation
 * 
 * Feature: realtime-transcription-analysis
 * Property 4: For any analysis update, the displayed SBAR content must match 
 * the currently selected analysis type, and switching types must immediately 
 * trigger a new analysis
 * 
 * Validates: Requirements 2.2, 2.3, 2.4, 6.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';
import { extractSBARContent, type AnalysisType } from '@/app/lib/sbar-extractor';
import * as fc from 'fast-check';

describe('Property: Analysis Type Preservation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should ensure displayed SBAR content always matches selected analysis type', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random sequences of analysis type switches with transcript updates
        fc.array(
          fc.record({
            type: fc.constantFrom<AnalysisType>('summary', 'soap', 'action_items', 'risk_assessment'),
            transcriptAddition: fc.string({ minLength: 301, maxLength: 500 }),
          }),
          { minLength: 2, maxLength: 6 }
        ),
        async (analysisSequence) => {
          // Track all completed analyses
          const completedAnalyses: Array<{ type: AnalysisType; requestedType: AnalysisType }> = [];

          // Mock fetch to return type-specific content
          const mockFetch = vi.fn().mockImplementation(async (url, options) => {
            const body = JSON.parse(options.body);
            const requestedType = body.type as AnalysisType;

            // Generate type-specific content
            let content = '';
            switch (requestedType) {
              case 'summary':
                content = '## Situation\nPatient presents with symptoms\n## Background\nMedical history\n## Assessment\nClinical findings\n## Recommendation\nTreatment plan';
                break;
              case 'soap':
                content = '## Subjective\nPatient complaints\n## Objective\nVital signs\n## Assessment\nDiagnosis\n## Plan\nTreatment';
                break;
              case 'action_items':
                content = '- Follow up in 2 weeks\n- Schedule lab tests\n- Prescribe medication';
                break;
              case 'risk_assessment':
                content = 'High risk factors identified: hypertension, diabetes';
                break;
            }

            return {
              ok: true,
              json: async () => ({ type: requestedType, content }),
            };
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn((content) => {
            // Track what type was in the last fetch call
            const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
            if (lastCall) {
              const requestedType = JSON.parse(lastCall[1].body).type;
              completedAnalyses.push({ type: content.type, requestedType });
            }
          });
          const onAnalysisError = vi.fn();

          let currentTranscript = '';

          const { rerender, unmount } = renderHook(
            ({ transcript, analysisType }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: analysisType,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript: currentTranscript, analysisType: analysisSequence[0].type } }
          );

          // Process each type switch with transcript update
          for (const item of analysisSequence) {
            currentTranscript += item.transcriptAddition;

            // Rerender with new transcript and analysis type
            rerender({ transcript: currentTranscript, analysisType: item.type });

            // Advance timers to trigger debounced analysis
            await vi.advanceTimersByTimeAsync(2500);
          }

          // Wait for all analyses to complete
          await waitFor(() => {
            expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
          }, { timeout: 1000 });

          // Verify all completed analyses match their requested types
          for (const analysis of completedAnalyses) {
            expect(analysis.type).toBe(analysis.requestedType);
          }

          unmount();
        }
      ),
      { numRuns: 100, timeout: 10000 }
    );
  });

  it('should trigger new analysis when switching types with transcript updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate pairs of different analysis types with transcript updates
        fc.tuple(
          fc.constantFrom<AnalysisType>('summary', 'soap', 'action_items', 'risk_assessment'),
          fc.constantFrom<AnalysisType>('summary', 'soap', 'action_items', 'risk_assessment')
        ).filter(([type1, type2]) => type1 !== type2), // Ensure types are different
        async ([firstType, secondType]) => {
          const mockFetch = vi.fn().mockImplementation(async (url, options) => {
            const body = JSON.parse(options.body);
            return {
              ok: true,
              json: async () => ({
                type: body.type,
                content: `Content for ${body.type}`,
              }),
            };
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn();
          const onAnalysisError = vi.fn();

          let transcript = 'x'.repeat(500);

          const { rerender, unmount } = renderHook(
            ({ transcript, analysisType }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: analysisType,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript, analysisType: firstType } }
          );

          // Wait for first analysis
          await vi.advanceTimersByTimeAsync(2500);
          await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
          }, { timeout: 1000 });

          const firstCallCount = mockFetch.mock.calls.length;

          // Add more transcript and switch to second type
          transcript += 'x'.repeat(350);
          rerender({ transcript, analysisType: secondType });

          // Advance timers to trigger new analysis
          await vi.advanceTimersByTimeAsync(2500);

          // Verify new analysis was triggered
          await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(firstCallCount + 1);
          }, { timeout: 1000 });

          // Verify the second call used the new type
          const secondCall = mockFetch.mock.calls[1];
          const secondCallBody = JSON.parse(secondCall[1].body);
          expect(secondCallBody.type).toBe(secondType);

          unmount();
        }
      ),
      { numRuns: 100, timeout: 10000 }
    );
  });

  it('should preserve type-specific SBAR structure across multiple updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<AnalysisType>('summary', 'soap', 'action_items', 'risk_assessment'),
        fc.integer({ min: 2, max: 5 }), // Number of transcript updates
        async (analysisType, numUpdates) => {
          const mockFetch = vi.fn().mockImplementation(async (url, options) => {
            const body = JSON.parse(options.body);
            const requestedType = body.type as AnalysisType;

            // Generate type-specific content
            let content = '';
            switch (requestedType) {
              case 'summary':
                content = '## Situation\nTest situation\n## Background\nTest background\n## Assessment\nTest assessment\n## Recommendation\nTest recommendation';
                break;
              case 'soap':
                content = '## Subjective\nTest subjective\n## Objective\nTest objective\n## Assessment\nTest assessment\n## Plan\nTest plan';
                break;
              case 'action_items':
                content = '- Action 1\n- Action 2\n- Action 3';
                break;
              case 'risk_assessment':
                content = 'Risk factors: test risk 1, test risk 2';
                break;
            }

            return {
              ok: true,
              json: async () => ({ type: requestedType, content }),
            };
          });
          global.fetch = mockFetch;

          const completedAnalyses: any[] = [];
          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn((content) => {
            completedAnalyses.push(content);
          });
          const onAnalysisError = vi.fn();

          let transcript = 'x'.repeat(500);

          const { rerender, unmount } = renderHook(
            ({ transcript }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: analysisType,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript } }
          );

          // Generate multiple transcript updates
          for (let i = 0; i < numUpdates; i++) {
            transcript += 'x'.repeat(350); // Above threshold
            rerender({ transcript });
            await vi.advanceTimersByTimeAsync(2500);
          }

          // Wait for all analyses to complete
          await waitFor(() => {
            expect(completedAnalyses.length).toBeGreaterThan(0);
          }, { timeout: 1000 });

          // Verify all completed analyses have the correct type
          for (const analysis of completedAnalyses) {
            expect(analysis.type).toBe(analysisType);

            // Verify SBAR structure is complete
            expect(analysis.situation).toBeTruthy();
            expect(analysis.background).toBeTruthy();
            expect(analysis.assessment).toBeTruthy();
            expect(analysis.recommendation).toBeTruthy();
          }

          unmount();
        }
      ),
      { numRuns: 100, timeout: 10000 }
    );
  });

  it('should maintain type consistency when transcript updates trigger analysis', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate sequences with type and transcript changes
        fc.array(
          fc.record({
            type: fc.constantFrom<AnalysisType>('summary', 'soap', 'action_items', 'risk_assessment'),
            transcriptAddition: fc.string({ minLength: 301, maxLength: 500 }),
            delayMs: fc.integer({ min: 2100, max: 3000 }), // Beyond debounce to ensure completion
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (updates) => {
          const completedAnalyses: Array<{ type: AnalysisType; requestedType: AnalysisType }> = [];

          const mockFetch = vi.fn().mockImplementation(async (url, options) => {
            const body = JSON.parse(options.body);
            const requestedType = body.type as AnalysisType;

            return {
              ok: true,
              json: async () => ({
                type: requestedType,
                content: `Content for ${requestedType}`,
              }),
            };
          });
          global.fetch = mockFetch;

          const onAnalysisStart = vi.fn();
          const onAnalysisComplete = vi.fn((content) => {
            // Track what type was requested vs what was returned
            const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
            if (lastCall) {
              const requestedType = JSON.parse(lastCall[1].body).type;
              completedAnalyses.push({ type: content.type, requestedType });
            }
          });
          const onAnalysisError = vi.fn();

          let transcript = '';

          const { rerender, unmount } = renderHook(
            ({ transcript, analysisType }) =>
              useRealTimeAnalysis({
                fullTranscript: transcript,
                activeAnalysisType: analysisType,
                appointmentId: 'test-appointment-id',
                scribeIsActive: true,
                onAnalysisStart,
                onAnalysisComplete,
                onAnalysisError,
              }),
            { initialProps: { transcript, analysisType: updates[0].type } }
          );

          // Process updates with delays
          for (const update of updates) {
            transcript += update.transcriptAddition;
            rerender({ transcript, analysisType: update.type });
            await vi.advanceTimersByTimeAsync(update.delayMs);
          }

          // Wait for any pending analyses
          await waitFor(() => {
            expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
          }, { timeout: 1000 });

          // Verify all completed analyses match their requested types
          for (const analysis of completedAnalyses) {
            expect(analysis.type).toBe(analysis.requestedType);
          }

          unmount();
        }
      ),
      { numRuns: 100, timeout: 10000 }
    );
  });
});
