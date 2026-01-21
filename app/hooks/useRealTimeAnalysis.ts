/**
 * Real-Time Analysis Hook
 * 
 * Manages automatic analysis updates as transcription progresses
 * with debouncing and threshold-based triggering
 */

import { useEffect, useRef } from 'react';
import { extractSBARContent, type AnalysisType, type SBARContent } from '@/app/lib/sbar-extractor';

interface UseRealTimeAnalysisProps {
  fullTranscript: string;
  activeAnalysisType: AnalysisType | null;
  appointmentId: string;
  scribeIsActive: boolean;
  onAnalysisStart: () => void;
  onAnalysisComplete: (content: SBARContent) => void;
  onAnalysisError: (error: string) => void;
}

const TRANSCRIPT_THRESHOLD = 300; // Characters
const DEBOUNCE_DELAY = 2000; // 2 seconds
const MAX_TRANSCRIPT_LENGTH = 50000; // Limit transcript to last 50,000 characters for performance

export function useRealTimeAnalysis({
  fullTranscript,
  activeAnalysisType,
  appointmentId,
  scribeIsActive,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
}: UseRealTimeAnalysisProps) {
  const lastTranscriptLengthRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAnalysisTypeRef = useRef<AnalysisType | null>(null);

  // Cancel pending analysis when analysis type changes
  useEffect(() => {
    if (activeAnalysisType !== lastAnalysisTypeRef.current) {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      lastAnalysisTypeRef.current = activeAnalysisType;
    }
  }, [activeAnalysisType]);

  useEffect(() => {
    // Only trigger analysis if:
    // 1. Scribe is active
    // 2. An analysis type is selected
    // 3. Transcript length increased by more than threshold
    if (!scribeIsActive || !activeAnalysisType || !appointmentId) {
      return;
    }

    const currentLength = fullTranscript.length;
    const lengthDelta = currentLength - lastTranscriptLengthRef.current;

    // Check if threshold exceeded
    if (lengthDelta < TRANSCRIPT_THRESHOLD) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      triggerAnalysis();
    }, DEBOUNCE_DELAY);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fullTranscript, activeAnalysisType, appointmentId, scribeIsActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function triggerAnalysis() {
    if (!activeAnalysisType || !appointmentId) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Update last transcript length
    lastTranscriptLengthRef.current = fullTranscript.length;

    // Truncate transcript to last MAX_TRANSCRIPT_LENGTH characters for very long sessions
    const truncatedTranscript = fullTranscript.length > MAX_TRANSCRIPT_LENGTH
      ? fullTranscript.slice(-MAX_TRANSCRIPT_LENGTH)
      : fullTranscript;

    // Notify start
    onAnalysisStart();

    try {
      const response = await fetch('/api/transcribe/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          transcript: truncatedTranscript,
          type: activeAnalysisType,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Analysis failed');
      }

      const data = await response.json();
      const rawContent = data.content || '';

      // Extract SBAR content
      const sbarContent = extractSBARContent(rawContent, activeAnalysisType);

      // Notify completion
      onAnalysisComplete(sbarContent);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      // Notify error
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      onAnalysisError(errorMessage);
    }
  }

  // Return manual trigger function for button clicks and cancel function
  return {
    triggerManualAnalysis: () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Trigger immediately
      triggerAnalysis();
    },
    cancelPendingAnalysis: () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Cancel in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    },
  };
}
