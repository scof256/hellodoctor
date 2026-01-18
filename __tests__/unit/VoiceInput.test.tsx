import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { VoiceInput } from '@/app/components/VoiceInput';

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    if (this.onstart) {
      this.onstart();
    }
  }

  stop() {
    if (this.onend) {
      this.onend();
    }
  }

  abort() {
    if (this.onend) {
      this.onend();
    }
  }

  // Helper method to simulate recognition result
  simulateResult(transcript: string, isFinal: boolean = true) {
    if (this.onresult) {
      const event = {
        results: [
          {
            0: { transcript },
            isFinal,
          },
        ],
      };
      this.onresult(event);
    }
  }

  // Helper method to simulate error
  simulateError(error: string) {
    if (this.onerror) {
      const event = { error };
      this.onerror(event);
    }
  }
}

// Mock getUserMedia
const mockGetUserMedia = vi.fn();

describe('VoiceInput Component', () => {
  let mockRecognition: MockSpeechRecognition;

  beforeEach(() => {
    // Setup SpeechRecognition mock
    mockRecognition = new MockSpeechRecognition();
    (global as any).SpeechRecognition = vi.fn(() => mockRecognition);
    (global as any).webkitSpeechRecognition = vi.fn(() => mockRecognition);

    // Setup getUserMedia mock
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    });

    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [],
    });

    // Mock AudioContext
    (global as any).AudioContext = vi.fn(() => ({
      createAnalyser: () => ({
        fftSize: 256,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
      }),
      createMediaStreamSource: () => ({
        connect: vi.fn(),
      }),
      close: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial idle state', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    // Check that microphone button is rendered
    const button = screen.getByLabelText('Start recording');
    expect(button).toBeInTheDocument();

    // Check that placeholder text is shown
    expect(screen.getByText('Tap to speak')).toBeInTheDocument();
  });

  it('should show custom placeholder when provided', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(
      <VoiceInput
        onTranscript={onTranscript}
        onError={onError}
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByText('Custom placeholder')).toBeInTheDocument();
  });

  it('should transition to recording state when button is clicked', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Check that button has recording state styling (red background)
    const recordingButton = screen.getByLabelText('Stop recording');
    expect(recordingButton).toHaveClass('bg-red-500');
    expect(recordingButton).toHaveClass('animate-pulse');
  });

  it('should show cancel button during recording', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Cancel recording')).toBeInTheDocument();
    });
  });

  it('should call onTranscript with final transcript', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate recognition result
    mockRecognition.simulateResult('Hello world', true);

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('Hello world');
    });
  });

  it('should display interim transcript', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate interim result
    mockRecognition.simulateResult('Hello', false);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    // Should not call onTranscript for interim results
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('should handle no-speech error', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate no-speech error
    mockRecognition.simulateError('no-speech');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('No speech detected. Please try again.');
    });
  });

  it('should handle audio-capture error', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate audio-capture error
    mockRecognition.simulateError('audio-capture');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Microphone not available. Please check permissions.'
      );
    });
  });

  it('should handle not-allowed error', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate not-allowed error
    mockRecognition.simulateError('not-allowed');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Microphone permission denied. Please enable in settings.'
      );
    });
  });

  it('should handle network error', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate network error
    mockRecognition.simulateError('network');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network error. Please check your connection.');
    });
  });

  it('should stop recording when stop button is clicked', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    // Start recording
    const startButton = screen.getByLabelText('Start recording');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Stop recording
    const stopButton = screen.getByLabelText('Stop recording');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    });
  });

  it('should cancel recording when cancel button is clicked', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    // Start recording
    const startButton = screen.getByLabelText('Start recording');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Cancel recording')).toBeInTheDocument();
    });

    // Cancel recording
    const cancelButton = screen.getByLabelText('Cancel recording');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    });

    // Should not call onTranscript when cancelled
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('should show processing state after final result', async () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    const button = screen.getByLabelText('Start recording');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    // Simulate final result
    mockRecognition.simulateResult('Test transcript', true);

    // Should call onTranscript
    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('Test transcript');
    });

    // After processing completes (500ms timeout), should return to idle state
    await waitFor(
      () => {
        expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should set correct language for English', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} language="en" />);

    expect(mockRecognition.lang).toBe('en-US');
  });

  it('should set correct language for Luganda', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} language="lg" />);

    expect(mockRecognition.lang).toBe('lg-UG');
  });

  it('should set correct language for Swahili', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} language="sw" />);

    expect(mockRecognition.lang).toBe('sw-KE');
  });

  it('should show error when SpeechRecognition is not supported', () => {
    // Remove SpeechRecognition from global
    delete (global as any).SpeechRecognition;
    delete (global as any).webkitSpeechRecognition;

    const onTranscript = vi.fn();
    const onError = vi.fn();

    render(<VoiceInput onTranscript={onTranscript} onError={onError} />);

    expect(onError).toHaveBeenCalledWith('Speech recognition is not supported in this browser');
  });
});
