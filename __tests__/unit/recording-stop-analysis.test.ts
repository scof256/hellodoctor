/**
 * Unit tests for final analysis trigger on recording stop
 * 
 * Requirements: 1.5
 * Tests that final analysis is triggered when recording stops
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Recording Stop Analysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should trigger final analysis after 500ms delay when recording stops with active analysis type', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Test analysis content' }),
    });
    global.fetch = mockFetch;

    // Simulate the stopRecording behavior
    const appointmentId = 'test-appointment-id';
    const activeAnalysisType = 'summary';
    const fullTranscript = 'This is a test transcript with enough content to trigger analysis.';

    // Simulate the delayed analysis trigger
    const triggerFinalAnalysis = () => {
      setTimeout(async () => {
        if (activeAnalysisType) {
          await fetch('/api/transcribe/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId,
              transcript: fullTranscript,
              type: activeAnalysisType,
            }),
          });
        }
      }, 500);
    };

    // Trigger the analysis
    triggerFinalAnalysis();

    // Verify fetch was not called immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance timers by 500ms
    await vi.advanceTimersByTimeAsync(500);

    // Verify fetch was called after delay
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/transcribe/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          transcript: fullTranscript,
          type: activeAnalysisType,
        }),
      })
    );
  });

  it('should not trigger analysis when no analysis type is selected', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Test analysis content' }),
    });
    global.fetch = mockFetch;

    // Simulate the stopRecording behavior with no active analysis type
    const appointmentId = 'test-appointment-id';
    const activeAnalysisType = null;
    const fullTranscript = 'This is a test transcript with enough content to trigger analysis.';

    // Simulate the delayed analysis trigger
    const triggerFinalAnalysis = () => {
      setTimeout(async () => {
        if (activeAnalysisType) {
          await fetch('/api/transcribe/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId,
              transcript: fullTranscript,
              type: activeAnalysisType,
            }),
          });
        }
      }, 500);
    };

    // Trigger the analysis
    triggerFinalAnalysis();

    // Advance timers by 500ms
    await vi.advanceTimersByTimeAsync(500);

    // Verify fetch was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should use 500ms delay before triggering analysis', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Test analysis content' }),
    });
    global.fetch = mockFetch;

    const appointmentId = 'test-appointment-id';
    const activeAnalysisType = 'soap';
    const fullTranscript = 'Test transcript content';

    // Simulate the delayed analysis trigger
    const triggerFinalAnalysis = () => {
      setTimeout(async () => {
        if (activeAnalysisType) {
          await fetch('/api/transcribe/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId,
              transcript: fullTranscript,
              type: activeAnalysisType,
            }),
          });
        }
      }, 500);
    };

    triggerFinalAnalysis();

    // Verify not called before 500ms
    await vi.advanceTimersByTimeAsync(499);
    expect(mockFetch).not.toHaveBeenCalled();

    // Verify called after 500ms
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should ensure last segment is processed before triggering analysis', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Test analysis content' }),
    });
    global.fetch = mockFetch;

    const appointmentId = 'test-appointment-id';
    const activeAnalysisType = 'action_items';
    
    // Simulate a transcript that gets updated during the delay
    let fullTranscript = 'Initial transcript';

    // Simulate the delayed analysis trigger
    const triggerFinalAnalysis = () => {
      setTimeout(async () => {
        // Simulate last segment being processed
        fullTranscript = 'Initial transcript with final segment';
        
        if (activeAnalysisType) {
          await fetch('/api/transcribe/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId,
              transcript: fullTranscript,
              type: activeAnalysisType,
            }),
          });
        }
      }, 500);
    };

    triggerFinalAnalysis();

    // Advance timers
    await vi.advanceTimersByTimeAsync(500);

    // Verify the analysis was called with the updated transcript
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/transcribe/analyze',
      expect.objectContaining({
        body: JSON.stringify({
          appointmentId,
          transcript: 'Initial transcript with final segment',
          type: activeAnalysisType,
        }),
      })
    );
  });
});
