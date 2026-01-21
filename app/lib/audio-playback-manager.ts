/**
 * Audio Playback Manager
 * 
 * Manages audio playback for transcript segments with progress tracking
 * and ensures only one segment plays at a time.
 */

export interface PlaybackState {
  segmentId: string | null;
  isPlaying: boolean;
  progress: number; // 0-1
  duration: number; // seconds
}

type ProgressCallback = (progress: number) => void;
type PlaybackEndCallback = () => void;

export class AudioPlaybackManager {
  private audio: HTMLAudioElement;
  private currentSegmentId: string | null = null;
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private playbackEndCallbacks: Set<PlaybackEndCallback> = new Set();
  private progressInterval: number | null = null;

  constructor() {
    this.audio = new Audio();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.audio.addEventListener('ended', () => {
      this.handlePlaybackEnd();
    });

    this.audio.addEventListener('error', () => {
      console.error('Audio playback error');
      this.handlePlaybackEnd();
    });

    this.audio.addEventListener('pause', () => {
      this.stopProgressTracking();
    });

    this.audio.addEventListener('play', () => {
      this.startProgressTracking();
    });
  }

  /**
   * Play audio for a specific segment
   */
  play(segmentId: string, audioUrl: string): void {
    // Stop current playback if different segment
    if (this.currentSegmentId && this.currentSegmentId !== segmentId) {
      this.stop();
    }

    this.currentSegmentId = segmentId;
    
    // If same segment and paused, resume
    if (this.audio.src === audioUrl && this.audio.paused) {
      this.audio.play().catch((error) => {
        console.error('Failed to resume audio:', error);
      });
      return;
    }

    // Load and play new audio
    this.audio.src = audioUrl;
    this.audio.load();
    this.audio.play().catch((error) => {
      console.error('Failed to play audio:', error);
      this.handlePlaybackEnd();
    });
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.stopProgressTracking();
    this.currentSegmentId = null;
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return {
      segmentId: this.currentSegmentId,
      isPlaying: !this.audio.paused && this.currentSegmentId !== null,
      progress: this.audio.duration > 0 ? this.audio.currentTime / this.audio.duration : 0,
      duration: this.audio.duration || 0,
    };
  }

  /**
   * Register callback for progress updates
   */
  onProgressUpdate(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Register callback for playback end
   */
  onPlaybackEnd(callback: PlaybackEndCallback): () => void {
    this.playbackEndCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.playbackEndCallbacks.delete(callback);
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.audio.src = '';
    this.progressCallbacks.clear();
    this.playbackEndCallbacks.clear();
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    this.progressInterval = window.setInterval(() => {
      const progress = this.audio.duration > 0 
        ? this.audio.currentTime / this.audio.duration 
        : 0;
      
      this.progressCallbacks.forEach((callback) => {
        try {
          callback(progress);
        } catch (error) {
          console.error('Error in progress callback:', error);
        }
      });
    }, 100); // Update every 100ms
  }

  private stopProgressTracking(): void {
    if (this.progressInterval !== null) {
      window.clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private handlePlaybackEnd(): void {
    this.stopProgressTracking();
    this.currentSegmentId = null;
    
    this.playbackEndCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in playback end callback:', error);
      }
    });
  }
}
