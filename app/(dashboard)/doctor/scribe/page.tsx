'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Mic, StopCircle, Upload, Sparkles, Copy, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { SegmentControls, type TranscriptSegment } from '@/app/components/SegmentControls';
import { AudioPlaybackManager } from '@/app/lib/audio-playback-manager';
import { 
  compressAudio, 
  shouldWarnAboutSize, 
  exceedsApiLimit, 
  formatFileSize 
} from '@/app/lib/audio-compression';
import { useRealTimeAnalysis } from '@/app/hooks/useRealTimeAnalysis';
import { type AnalysisType, type SBARContent } from '@/app/lib/sbar-extractor';
import { SBARDisplay } from '@/app/components/SBARDisplay';

type LiveInsightItem = {
  id: string;
  timestamp: number;
  content: string;
};

const CHUNK_DURATION_MS = 60 * 1000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function ScribePageLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointment Scribe</h1>
          <p className="text-slate-500 mt-1">Loading...</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-2/3"></div>
      </div>
    </div>
  );
}

export default function DoctorScribePage() {
  return (
    <Suspense fallback={<ScribePageLoading />}>
      <DoctorScribePageContent />
    </Suspense>
  );
}

function DoctorScribePageContent() {
  const searchParams = useSearchParams();
  const appointmentIdParam = searchParams.get('appointmentId') ?? '';
  const appointmentId = useMemo(() => {
    return isUuid(appointmentIdParam) ? appointmentIdParam : '';
  }, [appointmentIdParam]);

  const utils = api.useUtils();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);

  // Audio playback state
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const audioManagerRef = useRef<AudioPlaybackManager | null>(null);

  const [activeAnalysisType, setActiveAnalysisType] = useState<AnalysisType | null>(null);
  const [analysisContent, setAnalysisContent] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // SBAR content state for real-time analysis
  const [sbarContent, setSbarContent] = useState<SBARContent | null>(null);
  const [lastAnalysisTimestamp, setLastAnalysisTimestamp] = useState<number | null>(null);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);

  const [liveInsights, setLiveInsights] = useState<LiveInsightItem[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const prevTranscriptLengthRef = useRef(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const processingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const hasInitializedFromServerRef = useRef(false);

  const { data: scribeData } = api.appointment.getScribeData.useQuery(
    { appointmentId },
    { enabled: !!appointmentId },
  );

  const activateScribe = api.appointment.activateScribe.useMutation({
    onSuccess: async () => {
      if (appointmentId) {
        await utils.appointment.getScribeData.invalidate({ appointmentId });
      }
      await utils.appointment.getMyAppointments.invalidate();
    },
  });

  const deactivateScribe = api.appointment.deactivateScribe.useMutation({
    onSuccess: async () => {
      if (appointmentId) {
        await utils.appointment.getScribeData.invalidate({ appointmentId });
      }
      await utils.appointment.getMyAppointments.invalidate();
    },
  });

  const scribeIsActive = scribeData?.scribeIsActive ?? false;

  // Initialize audio playback manager
  useEffect(() => {
    audioManagerRef.current = new AudioPlaybackManager();

    const unsubscribeProgress = audioManagerRef.current.onProgressUpdate((progress) => {
      const state = audioManagerRef.current?.getState();
      if (state?.segmentId) {
        setPlaybackProgress((prev) => ({ ...prev, [state.segmentId!]: progress }));
      }
    });

    const unsubscribeEnd = audioManagerRef.current.onPlaybackEnd(() => {
      setPlayingSegmentId(null);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeEnd();
      audioManagerRef.current?.destroy();
      
      // Revoke all object URLs on unmount
      segments.forEach((segment) => {
        if (segment.audioUrl) {
          URL.revokeObjectURL(segment.audioUrl);
        }
      });
    };
  }, []);

  // Cleanup object URLs when segments are deleted
  useEffect(() => {
    return () => {
      segments.forEach((segment) => {
        if (segment.audioUrl && segment.isDeleted) {
          URL.revokeObjectURL(segment.audioUrl);
        }
      });
    };
  }, [segments]);

  const fullTranscript = useMemo(() => {
    return segments
      .filter((s) => !s.isPending && !s.error && !s.isDeleted)
      .map((s) => s.text)
      .join('\n\n');
  }, [segments]);

  // Integrate real-time analysis hook
  const { triggerManualAnalysis, cancelPendingAnalysis } = useRealTimeAnalysis({
    fullTranscript,
    activeAnalysisType,
    appointmentId,
    scribeIsActive,
    onAnalysisStart: () => {
      setIsAutoAnalyzing(true);
      setAnalysisLoading(true);
      setAnalysisError(null);
    },
    onAnalysisComplete: (content: SBARContent) => {
      setSbarContent(content);
      setLastAnalysisTimestamp(content.generatedAt);
      setIsAutoAnalyzing(false);
      setAnalysisLoading(false);
    },
    onAnalysisError: (error: string) => {
      setAnalysisError(error);
      setIsAutoAnalyzing(false);
      setAnalysisLoading(false);
    },
  });

  useEffect(() => {
    if (!appointmentId) return;
    if (!scribeData) return;
    if (isRecording || isProcessingFile) return;
    if (hasInitializedFromServerRef.current) return;

    const stored = typeof scribeData.scribeTranscript === 'string' ? scribeData.scribeTranscript : '';
    if (!stored.trim()) return;

    hasInitializedFromServerRef.current = true;
    prevTranscriptLengthRef.current = stored.length;

    setSegments([
      {
        id: 'stored',
        timestamp: Date.now(),
        text: stored,
        isPending: false,
        isDeleted: false,
      },
    ]);
  }, [appointmentId, isProcessingFile, isRecording, scribeData]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  useEffect(() => {
    if (!fullTranscript) {
      setLiveInsights([]);
      prevTranscriptLengthRef.current = 0;
      return;
    }

    const currentLength = fullTranscript.length;
    const shouldGenerate = currentLength > 200 && currentLength - prevTranscriptLengthRef.current > 600;
    if (!shouldGenerate) return;

    const timer = window.setTimeout(async () => {
      setIsGeneratingInsights(true);
      try {
        if (!appointmentId) return;
        const resp = await fetch('/api/transcribe/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId, transcript: fullTranscript, type: 'live_insights' }),
        });

        const data = (await resp.json()) as { content?: string; error?: string; details?: string };
        if (!resp.ok) return;

        const content = typeof data.content === 'string' ? data.content : '';
        if (content.trim()) {
          setLiveInsights((prev) => [
            ...prev,
            { id: Date.now().toString(), timestamp: Date.now(), content },
          ]);
          prevTranscriptLengthRef.current = currentLength;
        }
      } finally {
        setIsGeneratingInsights(false);
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [appointmentId, fullTranscript]);

  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    if (!appointmentId) throw new Error('Missing appointmentId. Open scribe from an appointment first.');
    if (!scribeIsActive) throw new Error('Scribe is inactive for this appointment. Activate it first.');

    const fd = new FormData();
    fd.append('appointmentId', appointmentId);
    fd.append('audio', blob, `audio-${Date.now()}`);

    const resp = await fetch('/api/transcribe', {
      method: 'POST',
      body: fd,
    });

    const data = (await resp.json()) as { transcript?: string; error?: string; details?: string };
    if (!resp.ok) {
      const msg = data.details || data.error || 'Transcription failed';
      throw new Error(msg);
    }

    return data.transcript || '';
  }, [appointmentId, scribeIsActive]);

  const processChunk = useCallback(
    async (audioBlob: Blob) => {
      const segmentId = Date.now().toString();

      // Compress audio before storing
      let compressedBlob = audioBlob;
      try {
        const compressed = await compressAudio(audioBlob, {
          bitrate: 20000,
          sampleRate: 16000,
          channelCount: 1,
        });
        compressedBlob = compressed.blob;
        
        // Check size and show warnings
        if (shouldWarnAboutSize(compressed.size)) {
          setSizeWarning(`Audio chunk is ${formatFileSize(compressed.size)}. Processing may be slower.`);
        }
        if (exceedsApiLimit(compressed.size)) {
          setError(`Audio chunk exceeds 25MB limit (${formatFileSize(compressed.size)}). Cannot transcribe.`);
          return;
        }
      } catch (e) {
        console.warn('Compression failed, using original audio:', e);
      }

      // Create object URL for playback
      const audioUrl = URL.createObjectURL(compressedBlob);

      setSegments((prev) => [
        ...prev,
        { 
          id: segmentId, 
          timestamp: Date.now(), 
          text: '', 
          isPending: true,
          isDeleted: false,
          audioBlob: compressedBlob,
          audioUrl,
        },
      ]);

      try {
        const text = await transcribeBlob(compressedBlob);
        setSegments((prev) =>
          prev.map((s) => (s.id === segmentId ? { ...s, text, isPending: false } : s)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Transcription failed';
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId ? { ...s, isPending: false, error: msg } : s,
          ),
        );
      }
    },
    [transcribeBlob],
  );

  const flushCurrentBuffer = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    processChunk(audioBlob);
  }, [processChunk]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());

    window.setTimeout(() => {
      flushCurrentBuffer();
      
      // Trigger final analysis after ensuring last segment is processed
      // Only trigger if activeAnalysisType is set
      if (activeAnalysisType && appointmentId && scribeIsActive) {
        triggerManualAnalysis();
      }
    }, 500);

    setIsRecording(false);

    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
    timerIntervalRef.current = null;
    processingIntervalRef.current = null;
  }, [flushCurrentBuffer, isRecording, activeAnalysisType, appointmentId, scribeIsActive, triggerManualAnalysis]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAnalysisError(null);
    setSizeWarning(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use optimal codec and settings for speech compression
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 20000, // 20 kbps - optimized for speech
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setDuration(0);
      setActiveAnalysisType(null);
      setAnalysisContent('');
      setLiveInsights([]);
      prevTranscriptLengthRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      processingIntervalRef.current = window.setInterval(() => {
        flushCurrentBuffer();
      }, CHUNK_DURATION_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to access microphone';
      setError(msg);
    }
  }, [flushCurrentBuffer]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setAnalysisError(null);
      setSizeWarning(null);
      setIsProcessingFile(true);
      setDuration(0);
      setActiveAnalysisType(null);
      setAnalysisContent('');
      setLiveInsights([]);
      prevTranscriptLengthRef.current = 0;

      try {
        if (isRecording) {
          setError('Please stop recording before uploading a file.');
          return;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          setError('Audio file is too large. Please upload a file under 25MB.');
          return;
        }

        const audio = new Audio(URL.createObjectURL(file));
        await new Promise((resolve) => {
          audio.onloadedmetadata = () => resolve(true);
        });
        if (Number.isFinite(audio.duration)) {
          setDuration(Math.floor(audio.duration));
        }

        // Compress uploaded audio
        let compressedBlob: Blob = file;
        try {
          const compressed = await compressAudio(file, {
            bitrate: 20000,
            sampleRate: 16000,
            channelCount: 1,
          });
          compressedBlob = compressed.blob;
          
          if (shouldWarnAboutSize(compressed.size)) {
            setSizeWarning(`Audio file is ${formatFileSize(compressed.size)}. Processing may take longer.`);
          }
          if (exceedsApiLimit(compressed.size)) {
            setError(`Compressed audio still exceeds 25MB limit (${formatFileSize(compressed.size)}). Cannot transcribe.`);
            return;
          }
        } catch (e) {
          console.warn('Compression failed, using original file:', e);
        }

        // Create object URL for playback
        const audioUrl = URL.createObjectURL(compressedBlob);

        const text = await transcribeBlob(compressedBlob);
        setSegments((prev) => [
          ...prev,
          {
            id: `file-${Date.now()}`,
            timestamp: Date.now(),
            text,
            isPending: false,
            isDeleted: false,
            audioBlob: compressedBlob,
            audioUrl,
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to process audio file.';
        setError(msg);
      } finally {
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [isRecording, transcribeBlob],
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAnalyze = useCallback(
    (type: AnalysisType) => {
      if (!fullTranscript.trim()) return;
      if (!appointmentId) {
        setAnalysisError('Missing appointmentId. Open scribe from an appointment first.');
        return;
      }
      if (!scribeIsActive) {
        setAnalysisError('Scribe is inactive for this appointment. Activate it first.');
        return;
      }

      // Set the active analysis type
      setActiveAnalysisType(type);
      
      // Set loading state immediately
      setAnalysisLoading(true);
      setAnalysisError(null);

      // Trigger manual analysis (bypasses debounce and cancels pending requests)
      triggerManualAnalysis();
    },
    [appointmentId, fullTranscript, scribeIsActive, triggerManualAnalysis],
  );

  const handleCopyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullTranscript);
    } catch {
      setError('Failed to copy transcript.');
    }
  }, [fullTranscript]);

  // Audio playback handlers
  const handlePlaySegment = useCallback((segmentId: string, audioUrl: string) => {
    if (!audioManagerRef.current) return;
    audioManagerRef.current.play(segmentId, audioUrl);
    setPlayingSegmentId(segmentId);
  }, []);

  const handlePauseSegment = useCallback(() => {
    if (!audioManagerRef.current) return;
    audioManagerRef.current.pause();
    setPlayingSegmentId(null);
  }, []);

  // Segment deletion handler
  const handleDeleteSegment = useCallback((segmentId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this transcript segment? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    setSegments((prev) =>
      prev.map((s) => {
        if (s.id === segmentId) {
          // Revoke object URL to free memory
          if (s.audioUrl) {
            URL.revokeObjectURL(s.audioUrl);
          }
          // Soft delete
          return { ...s, isDeleted: true, audioUrl: undefined, audioBlob: undefined };
        }
        return s;
      })
    );

    // Stop playback if this segment is playing
    if (playingSegmentId === segmentId) {
      handlePauseSegment();
    }
  }, [playingSegmentId, handlePauseSegment]);

  const handleClear = useCallback(() => {
    if (isRecording) stopRecording();
    
    // Revoke all object URLs
    segments.forEach((segment) => {
      if (segment.audioUrl) {
        URL.revokeObjectURL(segment.audioUrl);
      }
    });
    
    // Stop any playing audio
    audioManagerRef.current?.stop();
    setPlayingSegmentId(null);
    
    // Cancel any pending analysis requests
    cancelPendingAnalysis();
    
    setSegments([]);
    setDuration(0);
    setError(null);
    setSizeWarning(null);
    setActiveAnalysisType(null);
    setAnalysisContent('');
    setAnalysisError(null);
    setLiveInsights([]);
    prevTranscriptLengthRef.current = 0;
    hasInitializedFromServerRef.current = true;
    
    // Clear SBAR content and timestamp
    setSbarContent(null);
    setLastAnalysisTimestamp(null);
  }, [isRecording, stopRecording, segments, cancelPendingAnalysis]);

  const handleResetTranscription = useCallback(async () => {
    if (!appointmentId) {
      setError('Missing appointmentId. Open scribe from an appointment first.');
      return;
    }

    if (!scribeIsActive) {
      setError('Scribe must be active to reset transcription.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to reset the transcription? This will permanently delete all transcribed text from the database. This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const resp = await fetch('/api/transcribe/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });

      const data = (await resp.json()) as { success?: boolean; error?: string; details?: string };
      if (!resp.ok) {
        const msg = data.details || data.error || 'Failed to reset transcription';
        setError(msg);
        return;
      }

      // Cancel any pending analysis requests before clearing
      cancelPendingAnalysis();

      // Clear local state after successful reset
      handleClear();
      
      // Invalidate the query to refresh from server
      if (appointmentId) {
        await utils.appointment.getScribeData.invalidate({ appointmentId });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reset transcription';
      setError(msg);
    }
  }, [appointmentId, handleClear, scribeIsActive, utils.appointment.getScribeData, cancelPendingAnalysis]);

  const statusLabel = isRecording ? 'RECORDING' : isProcessingFile ? 'PROCESSING' : 'IDLE';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointment Scribe</h1>
          <p className="text-slate-500 mt-1">Record or upload audio to generate a transcript and clinical notes.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Enhanced Recording Indicator */}
          <div
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-3 transition-all ${
              isRecording
                ? 'bg-red-600 text-white shadow-lg'
                : isProcessingFile
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full ${
                isRecording ? 'bg-white animate-pulse' : isProcessingFile ? 'bg-white animate-pulse' : 'bg-slate-400'
              }`}
            ></div>
            <span className="tracking-wide">{statusLabel}</span>
            {isRecording && (
              <span className="text-2xl font-mono font-bold ml-2">{formatTime(duration)}</span>
            )}
          </div>

          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            disabled={isProcessingFile}
            title="Clear local transcript (does not affect database)"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>

          <button
            onClick={handleResetTranscription}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
            disabled={isProcessingFile || !appointmentId || !scribeIsActive}
            title="Permanently reset transcription (deletes from database)"
          >
            <Trash2 className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {!appointmentId && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-slate-700 font-medium">Select an appointment to begin.</p>
          <p className="text-sm text-slate-500 mt-1">
            Open scribe from an appointment in
            <a href="/doctor/appointments" className="ml-1 text-medical-700 underline">
              Appointments
            </a>
            .
          </p>
        </div>
      )}

      {!!appointmentId && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500 font-medium">Appointment</p>
            <p className="text-sm text-slate-800 font-mono break-all">{appointmentId}</p>
            <p className="text-xs text-slate-500 mt-1">
              Status: {scribeData?.status ?? '...'}
              <span className="mx-2">•</span>
              Scribe: {scribeIsActive ? 'ACTIVE' : 'INACTIVE'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!scribeIsActive ? (
              <button
                onClick={() => activateScribe.mutate({ appointmentId })}
                disabled={activateScribe.isPending}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Activate
              </button>
            ) : (
              <button
                onClick={() => deactivateScribe.mutate({ appointmentId })}
                disabled={deactivateScribe.isPending}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 font-medium">Session Duration</p>
              <p className="text-3xl font-mono font-bold text-slate-800 tracking-wider">{formatTime(duration)}</p>
            </div>

            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleFileUpload}
              />

              <button
                onClick={triggerFileInput}
                disabled={isRecording || isProcessingFile || !appointmentId || !scribeIsActive}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload audio
              </button>

              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessingFile || !appointmentId || !scribeIsActive}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-medical-600 hover:bg-medical-700'
                }`}
              >
                {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isRecording ? 'Stop' : 'Record'}
              </button>

              <button
                onClick={handleCopyTranscript}
                disabled={!fullTranscript.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </div>

          {(error || analysisError || sizeWarning) && (
            <div className={`border rounded-xl p-4 text-sm ${
              sizeWarning && !error && !analysisError
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {sizeWarning && !error && !analysisError && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{sizeWarning}</span>
                </div>
              )}
              {(error || analysisError) && <span>{error || analysisError}</span>}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Transcript</h2>
              {isGeneratingInsights && (
                <span className="text-xs text-emerald-600 font-medium animate-pulse">Updating insights...</span>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
              {segments.filter(s => !s.isDeleted).length === 0 ? (
                <div className="text-slate-400 text-sm">Start recording or upload an audio file to see a transcript.</div>
              ) : (
                segments
                  .filter(s => !s.isDeleted)
                  .map((segment) => (
                    <div key={segment.id} className={segment.isPending ? 'opacity-70' : 'opacity-100'}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {new Date(segment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {segment.isPending && (
                          <span className="text-xs text-emerald-600 font-medium animate-pulse">Transcribing...</span>
                        )}
                      </div>

                      {segment.isPending ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                          <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                        </div>
                      ) : segment.error ? (
                        <div className="text-sm text-red-600">Error: {segment.error}</div>
                      ) : (
                        <>
                          <div className="prose prose-slate prose-sm max-w-none text-slate-700">
                            <ReactMarkdown>{segment.text}</ReactMarkdown>
                          </div>
                          
                          {/* Segment Controls */}
                          <SegmentControls
                            segment={segment}
                            isPlaying={playingSegmentId === segment.id}
                            playbackProgress={playbackProgress[segment.id] || 0}
                            onPlay={() => segment.audioUrl && handlePlaySegment(segment.id, segment.audioUrl)}
                            onPause={handlePauseSegment}
                            onDelete={() => handleDeleteSegment(segment.id)}
                          />
                        </>
                      )}
                    </div>
                  ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-labelledby="clinical-notes-heading">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <h2 id="clinical-notes-heading" className="font-semibold text-slate-800">Clinical Notes</h2>
            </div>

            {(liveInsights.length > 0 || isGeneratingInsights) && (
              <div className="border-b border-emerald-100 bg-emerald-50/30">
                <div className="px-4 py-2 bg-emerald-100/50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Live Assistant Feed</h3>
                </div>
                <div className="max-h-56 overflow-y-auto p-4 space-y-6">
                  {liveInsights.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-2 animate-pulse">Analyzing conversation context...</div>
                  ) : (
                    liveInsights.map((item) => (
                      <div key={item.id} className="relative pl-4 border-l-2 border-emerald-200">
                        <div className="text-[10px] text-slate-400 font-mono mb-1">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                        <div className="prose prose-sm max-w-none text-slate-700 text-sm">
                          <ReactMarkdown>{item.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="p-4 flex flex-wrap gap-2 border-b border-slate-100" role="group" aria-label="Analysis type selection">
              {([
                { type: 'summary' as const, label: 'Summary' },
                { type: 'soap' as const, label: 'SOAP' },
                { type: 'action_items' as const, label: 'Action items' },
                { type: 'risk_assessment' as const, label: 'Risk flags' },
              ] as const).map((t) => (
                <button
                  key={t.type}
                  onClick={() => handleAnalyze(t.type)}
                  disabled={analysisLoading || !fullTranscript.trim() || !appointmentId || !scribeIsActive}
                  aria-pressed={activeAnalysisType === t.type}
                  aria-label={`Generate ${t.label} analysis`}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors border disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    activeAnalysisType === t.type
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 bg-slate-50/50 min-h-[300px]">
              {!sbarContent && !analysisLoading && !isAutoAnalyzing && !analysisError ? (
                <div className="text-slate-400 text-sm">Select a note type to generate doctor-ready documentation.</div>
              ) : (
                <SBARDisplay
                  content={sbarContent}
                  isLoading={analysisLoading || isAutoAnalyzing}
                  lastUpdated={lastAnalysisTimestamp}
                  error={analysisError}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
