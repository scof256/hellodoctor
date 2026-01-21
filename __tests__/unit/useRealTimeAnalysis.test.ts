/**
 * Unit Tests: useRealTimeAnalysis Hook
 * 
 * Tests hook initialization, debounce timer setup/cleanup, API calls,
 * AbortController cancellation, and error handling
 * 
 * Requirements: 1.1, 1.2, 1.3, 5.2, 5.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';

describe('useRealTimeAnalysis Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize without triggering analysis', () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result } = renderHook(() =>
        useRealTimeAnalysis({
          fullTranscript: '',
          activeAnalysisType: 'summary',
          appointmentId: 'test-id',
          scribeIsActive: true,
          onAnalysisStart,
          onAnalysisComplete,
          onAnalysisError,
        })
      );

      expect(result.current).toHaveProperty('triggerManualAnalysis');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(onAnalysisStart).not.toHaveBeenCalled();
    });

    it('should not trigger analysis when scribe is inactive', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: false, // Inactive
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // Add transcript above threshold
      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not trigger analysis when no analysis type is selected', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: null, // No type selected
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // Add transcript above threshold
      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Debounce Timer Setup and Cleanup', () => {
    it('should set up debounce timer when transcript exceeds threshold', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // Add transcript above threshold
      rerender({ transcript: 'x'.repeat(400) });

      // Should not trigger immediately
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance by 1 second (within debounce)
      vi.advanceTimersByTime(1000);
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance to complete debounce (total 2 seconds)
      vi.advanceTimersByTime(1000);
      
      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear debounce timer on unmount', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender, unmount } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // Add transcript above threshold
      rerender({ transcript: 'x'.repeat(400) });

      // Unmount before debounce completes
      unmount();

      // Advance timers
      vi.advanceTimersByTime(2000);

      // Should not trigger after unmount
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reset debounce timer on subsequent updates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // First update
      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(1000);

      // Second update (resets timer)
      rerender({ transcript: 'x'.repeat(800) });
      vi.advanceTimersByTime(1000);

      // Should not have triggered yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Complete debounce from second update
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('API Call with Correct Parameters', () => {
    it('should call API with correct parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test analysis' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const transcript = 'Patient presents with headache and fever...'.repeat(10);
      const appointmentId = 'test-appointment-123';

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'soap',
            appointmentId,
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/transcribe/analyze',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId,
              transcript,
              type: 'soap',
            }),
          })
        );
      });
    });

    it('should call onAnalysisStart before API call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onAnalysisStart).toHaveBeenCalled();
      });
    });

    it('should call onAnalysisComplete with SBAR content on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'summary',
          content: '## Situation\nPatient has fever\n## Background\nNo history\n## Assessment\nLikely viral\n## Recommendation\nRest and fluids',
        }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onAnalysisComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            situation: expect.any(String),
            background: expect.any(String),
            assessment: expect.any(String),
            recommendation: expect.any(String),
            type: 'summary',
            generatedAt: expect.any(Number),
          })
        );
      });
    });
  });

  describe('AbortController Cancellation', () => {
    it('should cancel in-flight request on unmount', async () => {
      const abortSpy = vi.fn();
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ type: 'summary', content: 'Test' }),
            });
          }, 5000);
        });
      });
      global.fetch = mockFetch;

      // Mock AbortController
      const originalAbortController = global.AbortController;
      global.AbortController = class MockAbortController {
        signal = {};
        abort = abortSpy;
      } as any;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender, unmount } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      // Unmount while request is in flight
      unmount();

      expect(abortSpy).toHaveBeenCalled();

      // Restore
      global.AbortController = originalAbortController;
    });

    it('should cancel previous request when new analysis is triggered', async () => {
      const abortSpy = vi.fn();
      let abortControllerCount = 0;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      // Mock AbortController to track abort calls
      const originalAbortController = global.AbortController;
      global.AbortController = class MockAbortController {
        signal = {};
        abort = () => {
          abortControllerCount++;
          abortSpy();
        };
      } as any;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // First update
      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      // Second update (should cancel first)
      rerender({ transcript: 'x'.repeat(800) });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalled();
      });

      // Restore
      global.AbortController = originalAbortController;
    });
  });

  describe('Error Handling', () => {
    it('should call onAnalysisError when API returns error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ details: 'Analysis failed' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onAnalysisError).toHaveBeenCalledWith('Analysis failed');
      });
    });

    it('should call onAnalysisError when fetch throws', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onAnalysisError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should not call onAnalysisError for AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      const mockFetch = vi.fn().mockRejectedValue(abortError);
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender, unmount } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(2000);

      // Wait a bit for any async operations
      vi.advanceTimersByTime(100);

      // Should not call error handler for abort
      expect(onAnalysisError).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('Manual Trigger', () => {
    it('should provide triggerManualAnalysis function', () => {
      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result } = renderHook(() =>
        useRealTimeAnalysis({
          fullTranscript: '',
          activeAnalysisType: 'summary',
          appointmentId: 'test-id',
          scribeIsActive: true,
          onAnalysisStart,
          onAnalysisComplete,
          onAnalysisError,
        })
      );

      expect(result.current.triggerManualAnalysis).toBeInstanceOf(Function);
    });

    it('should trigger analysis immediately when manual trigger is called', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result } = renderHook(() =>
        useRealTimeAnalysis({
          fullTranscript: 'x'.repeat(400),
          activeAnalysisType: 'summary',
          appointmentId: 'test-id',
          scribeIsActive: true,
          onAnalysisStart,
          onAnalysisComplete,
          onAnalysisError,
        })
      );

      // Call manual trigger
      result.current.triggerManualAnalysis();

      // Should trigger immediately without waiting for debounce
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('should cancel pending debounce when manual trigger is called', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'summary', content: 'Test' }),
      });
      global.fetch = mockFetch;

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result, rerender } = renderHook(
        ({ transcript }) =>
          useRealTimeAnalysis({
            fullTranscript: transcript,
            activeAnalysisType: 'summary',
            appointmentId: 'test-id',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        { initialProps: { transcript: '' } }
      );

      // Trigger automatic analysis
      rerender({ transcript: 'x'.repeat(400) });
      vi.advanceTimersByTime(1000); // Partial debounce

      // Call manual trigger
      result.current.triggerManualAnalysis();

      // Should trigger immediately
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Advance remaining debounce time
      vi.advanceTimersByTime(1000);

      // Should still only have one call (debounce was cancelled)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

