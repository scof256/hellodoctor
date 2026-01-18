'use client';

import { useState, useEffect, useRef } from 'react';

export interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
  language?: string; // 'en', 'lg', 'sw'
  placeholder?: string;
}

export interface VoiceInputState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error?: string;
}

export function VoiceInput({
  onTranscript,
  onError,
  language = 'en',
  placeholder = 'Tap to speak',
}: VoiceInputProps) {
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isProcessing: false,
    transcript: '',
  });
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    // Map language codes
    const languageMap: Record<string, string> = {
      en: 'en-US',
      lg: 'lg-UG', // Luganda
      sw: 'sw-KE', // Swahili
    };
    recognition.lang = languageMap[language] || 'en-US';

    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isRecording: true, isProcessing: false }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript)
        .join('');

      setState((prev) => ({ ...prev, transcript }));

      // If final result, process it
      if (event.results[event.results.length - 1]?.isFinal) {
        setState((prev) => ({ ...prev, isProcessing: true }));
        onTranscript(transcript);
        setTimeout(() => {
          setState({
            isRecording: false,
            isProcessing: false,
            transcript: '',
          });
        }, 500);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available. Please check permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please enable in settings.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Error: ${event.error}`;
      }

      onError(errorMessage);
      setState({
        isRecording: false,
        isProcessing: false,
        transcript: '',
        error: errorMessage,
      });
    };

    recognition.onend = () => {
      setState((prev) => ({
        ...prev,
        isRecording: false,
      }));
      stopAudioVisualization();
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioVisualization();
    };
  }, [language, onTranscript, onError]);

  // Audio visualization
  const startAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255); // Normalize to 0-1
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleStart = () => {
    if (!recognitionRef.current) {
      onError('Speech recognition not available');
      return;
    }

    try {
      recognitionRef.current.start();
      startAudioVisualization();
    } catch (err) {
      console.error('Error starting recognition:', err);
      onError('Failed to start recording');
    }
  };

  const handleStop = () => {
    if (recognitionRef.current && state.isRecording) {
      recognitionRef.current.stop();
      stopAudioVisualization();
    }
  };

  const handleCancel = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      stopAudioVisualization();
    }
    setState({
      isRecording: false,
      isProcessing: false,
      transcript: '',
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Transcript display */}
      {state.transcript && (
        <div className="w-full rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
          <p className="text-base text-gray-900 dark:text-gray-100">
            {state.transcript}
          </p>
        </div>
      )}

      {/* Waveform visualization */}
      {state.isRecording && (
        <div className="flex items-center justify-center gap-1" style={{ height: '40px' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-red-500 transition-all duration-100"
              style={{
                height: `${Math.max(8, audioLevel * 40 * (1 + Math.sin(Date.now() / 100 + i)))}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main button */}
      <div className="relative">
        <button
          type="button"
          onClick={state.isRecording ? handleStop : handleStart}
          disabled={state.isProcessing}
          className={`
            flex h-14 w-14 items-center justify-center rounded-full
            transition-all duration-200
            ${
              state.isRecording
                ? 'animate-pulse bg-red-500 text-white'
                : state.isProcessing
                  ? 'bg-gray-400 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }
            disabled:cursor-not-allowed disabled:opacity-50
          `}
          aria-label={state.isRecording ? 'Stop recording' : 'Start recording'}
        >
          {state.isProcessing ? (
            <svg
              className="h-6 w-6 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </button>

        {/* Cancel button (appears during recording) */}
        {state.isRecording && (
          <button
            type="button"
            onClick={handleCancel}
            className="absolute -right-16 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            aria-label="Cancel recording"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Placeholder text */}
      {!state.isRecording && !state.isProcessing && !state.transcript && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{placeholder}</p>
      )}
    </div>
  );
}
