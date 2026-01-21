/**
 * Audio Compression Utility
 * 
 * Compresses audio files to minimize size before sending to LLM API.
 * Uses Web Audio API to resample, convert to mono, and re-encode at low bitrate.
 */

export interface CompressionOptions {
  bitrate: number; // 16000-24000 (16-24 kbps)
  sampleRate: number; // 16000 (16kHz)
  channelCount: 1; // mono
}

export interface CompressedAudio {
  blob: Blob;
  size: number;
  duration: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  bitrate: 20000, // 20 kbps - good balance for speech
  sampleRate: 16000, // 16kHz - sufficient for speech recognition
  channelCount: 1, // mono
};

/**
 * Compress audio blob to reduce file size while maintaining speech clarity
 */
export async function compressAudio(
  audioBlob: Blob,
  options: Partial<CompressionOptions> = {}
): Promise<CompressedAudio> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Create audio context for processing
    const audioContext = new AudioContext({ sampleRate: opts.sampleRate });
    
    // Decode the audio blob
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create offline context for resampling and mono conversion
    const offlineContext = new OfflineAudioContext(
      opts.channelCount,
      Math.ceil(audioBuffer.duration * opts.sampleRate),
      opts.sampleRate
    );
    
    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    // Render the processed audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to blob using MediaRecorder with low bitrate
    const compressedBlob = await encodeAudioBuffer(renderedBuffer, opts);
    
    await audioContext.close();
    
    return {
      blob: compressedBlob,
      size: compressedBlob.size,
      duration: renderedBuffer.duration,
    };
  } catch (error) {
    // If compression fails, return original with warning
    console.warn('Audio compression failed, using original:', error);
    return {
      blob: audioBlob,
      size: audioBlob.size,
      duration: 0, // Unknown duration
    };
  }
}

/**
 * Encode audio buffer to compressed blob using MediaRecorder
 */
async function encodeAudioBuffer(
  audioBuffer: AudioBuffer,
  options: CompressionOptions
): Promise<Blob> {
  // Create a MediaStream from the audio buffer
  const audioContext = new AudioContext({ sampleRate: options.sampleRate });
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create a destination to capture the stream
  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);
  
  // Determine best codec
  const mimeType = getSupportedMimeType();
  
  // Create MediaRecorder with low bitrate
  const mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType,
    audioBitsPerSecond: options.bitrate,
  });
  
  const chunks: Blob[] = [];
  
  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      audioContext.close();
      resolve(blob);
    };
    
    mediaRecorder.onerror = (event) => {
      audioContext.close();
      reject(new Error('MediaRecorder error during encoding'));
    };
    
    // Start recording and play the source
    mediaRecorder.start();
    source.start(0);
    
    // Stop after buffer duration
    setTimeout(() => {
      mediaRecorder.stop();
    }, audioBuffer.duration * 1000 + 100);
  });
}

/**
 * Get the best supported MIME type for audio recording
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus', // Best compression for speech
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return ''; // Browser will use default
}

/**
 * Check if audio size exceeds warning threshold
 */
export function shouldWarnAboutSize(sizeBytes: number): boolean {
  const WARNING_THRESHOLD = 5 * 1024 * 1024; // 5MB
  return sizeBytes > WARNING_THRESHOLD;
}

/**
 * Check if audio size exceeds API limit
 */
export function exceedsApiLimit(sizeBytes: number): boolean {
  const API_LIMIT = 25 * 1024 * 1024; // 25MB
  return sizeBytes > API_LIMIT;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
