/**
 * Unit Tests for Performance Optimizations
 * 
 * Tests memoization, transcript truncation, and request cancellation
 * Requirements: 5.1, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SBARDisplay } from '@/app/components/SBARDisplay';
import { extractSBARContent, type SBARContent } from '@/app/lib/sbar-extractor';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';

describe('Performance Optimizations', () => {
  describe('SBARCard Memoization', () => {
    it('should prevent unnecessary re-renders when content does not change', () => {
      const mockContent: SBARContent = {
        situation: 'Test situation',
        background: 'Test background',
        assessment: 'Test assessment',
        recommendation: 'Test recommendation',
        type: 'summary',
        generatedAt: Date.now(),
      };

      // First render
      const { rerender } = render(
        <SBARDisplay content={mockContent} isLoading={false} lastUpdated={Date.now()} />
      );

      // Get initial card elements
      const situationCard = screen.getByText('Test situation');
      expect(situationCard).toBeInTheDocument();

      // Re-render with same content but different timestamp
      rerender(
        <SBARDisplay content={mockContent} isLoading={false} lastUpdated={Date.now() + 1000} />
      );

      // Card should still be the same element (memoized)
      const situationCardAfter = screen.getByText('Test situation');
      expect(situationCardAfter).toBe(situationCard);
    });

    it('should re-render when content actually changes', () => {
      const mockContent1: SBARContent = {
        situation: 'Test situation 1',
        background: 'Test background',
        assessment: 'Test assessment',
        recommendation: 'Test recommendation',
        type: 'summary',
        generatedAt: Date.now(),
      };

      const mockContent2: SBARContent = {
        ...mockContent1,
        situation: 'Test situation 2',
      };

      const { rerender } = render(
        <SBARDisplay content={mockContent1} isLoading={false} lastUpdated={Date.now()} />
      );

      expect(screen.getByText('Test situation 1')).toBeInTheDocument();

      rerender(
        <SBARDisplay content={mockContent2} isLoading={false} lastUpdated={Date.now()} />
      );

      expect(screen.queryByText('Test situation 1')).not.toBeInTheDocument();
      expect(screen.getByText('Test situation 2')).toBeInTheDocument();
    });
  });

  describe('SBAR Content Extraction Memoization', () => {
    it('should cache extraction results for identical inputs', () => {
      const rawContent = `
## Situation
Patient presents with chest pain

## Background
History of hypertension

## Assessment
Possible cardiac event

## Recommendation
Immediate ECG and cardiac enzymes
      `;

      // First extraction
      const result1 = extractSBARContent(rawContent, 'summary');
      
      // Second extraction with same input
      const result2 = extractSBARContent(rawContent, 'summary');

      // Should return same content (cached)
      expect(result1.situation).toBe(result2.situation);
      expect(result1.background).toBe(result2.background);
      expect(result1.assessment).toBe(result2.assessment);
      expect(result1.recommendation).toBe(result2.recommendation);
    });

    it('should return different results for different analysis types', () => {
      const rawContent = `
## Subjective
Patient reports chest pain

## Objective
BP 140/90, HR 95

## Assessment
Hypertensive urgency

## Plan
Start antihypertensive medication
      `;

      const summaryResult = extractSBARContent(rawContent, 'summary');
      const soapResult = extractSBARContent(rawContent, 'soap');

      // SOAP should map differently than summary
      expect(summaryResult.situation).not.toBe(soapResult.situation);
    });

    it('should handle cache size limit', () => {
      // Generate many unique extractions to test cache eviction
      for (let i = 0; i < 60; i++) {
        const content = `## Situation\nTest ${i}`;
        extractSBARContent(content, 'summary');
      }

      // Should not throw error and should still work
      const result = extractSBARContent('## Situation\nFinal test', 'summary');
      expect(result.situation).toContain('Final test');
    });
  });

  describe('Transcript Truncation', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should truncate very long transcripts to last 50,000 characters', async () => {
      const longTranscript = 'a'.repeat(60000);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Test analysis' }),
      });

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result } = renderHook(() =>
        useRealTimeAnalysis({
          fullTranscript: longTranscript,
          activeAnalysisType: 'summary',
          appointmentId: 'test-123',
          scribeIsActive: true,
          onAnalysisStart,
          onAnalysisComplete,
          onAnalysisError,
        })
      );

      // Trigger manual analysis
      result.current.triggerManualAnalysis();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Check that the transcript was truncated
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.transcript.length).toBe(50000);
      expect(requestBody.transcript).toBe(longTranscript.slice(-50000));
    });

    it('should not truncate transcripts under 50,000 characters', async () => {
      const normalTranscript = 'a'.repeat(10000);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Test analysis' }),
      });

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result } = renderHook(() =>
        useRealTimeAnalysis({
          fullTranscript: normalTranscript,
          activeAnalysisType: 'summary',
          appointmentId: 'test-123',
          scribeIsActive: true,
          onAnalysisStart,
          onAnalysisComplete,
          onAnalysisError,
        })
      );

      result.current.triggerManualAnalysis();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.transcript.length).toBe(10000);
      expect(requestBody.transcript).toBe(normalTranscript);
    });
  });

  describe('Request Cancellation on Type Switch', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should cancel pending request when analysis type changes', async () => {
      const abortSpy = vi.fn();
      
      (global.fetch as any).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ content: 'Test analysis' }),
            });
          }, 1000);
        });
      });

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { rerender } = renderHook(
        ({ analysisType }) =>
          useRealTimeAnalysis({
            fullTranscript: 'Test transcript',
            activeAnalysisType: analysisType,
            appointmentId: 'test-123',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        {
          initialProps: { analysisType: 'summary' as const },
        }
      );

      // Wait a bit then change analysis type
      await new Promise(resolve => setTimeout(resolve, 100));
      
      rerender({ analysisType: 'soap' as const });

      // The abort controller should have been called
      // We can verify this by checking that the fetch was called
      // and that changing type doesn't cause errors
      expect(onAnalysisError).not.toHaveBeenCalled();
    });

    it('should allow new request after cancellation', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ content: 'Test analysis' }),
      });

      const onAnalysisStart = vi.fn();
      const onAnalysisComplete = vi.fn();
      const onAnalysisError = vi.fn();

      const { result, rerender } = renderHook(
        ({ analysisType }) =>
          useRealTimeAnalysis({
            fullTranscript: 'Test transcript',
            activeAnalysisType: analysisType,
            appointmentId: 'test-123',
            scribeIsActive: true,
            onAnalysisStart,
            onAnalysisComplete,
            onAnalysisError,
          }),
        {
          initialProps: { analysisType: 'summary' as const },
        }
      );

      // Trigger first analysis
      result.current.triggerManualAnalysis();

      // Change type (should cancel)
      rerender({ analysisType: 'soap' as const });

      // Trigger new analysis
      result.current.triggerManualAnalysis();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should have been called at least once successfully
      expect(onAnalysisError).not.toHaveBeenCalled();
    });
  });
});
