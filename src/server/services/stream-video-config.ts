/**
 * Stream Video Quality Configuration for Medical Consultations
 * Requirements: 8.5 - Configure video quality settings for medical consultations
 */

/**
 * Video quality presets optimized for medical consultations
 * Medical consultations require clear video for visual assessments
 */
export const VIDEO_QUALITY_PRESETS = {
  /**
   * High quality preset for medical consultations
   * Prioritizes clarity for visual assessments
   */
  medical: {
    targetResolution: { width: 1280, height: 720 },
    maxBitrate: 2500000, // 2.5 Mbps
    minBitrate: 500000,  // 500 Kbps minimum
    frameRate: 30,
    preferredCodec: 'VP8' as const,
  },
  
  /**
   * Standard quality for general consultations
   */
  standard: {
    targetResolution: { width: 1280, height: 720 },
    maxBitrate: 1500000, // 1.5 Mbps
    minBitrate: 300000,  // 300 Kbps minimum
    frameRate: 24,
    preferredCodec: 'VP8' as const,
  },
  
  /**
   * Low bandwidth preset for poor connections
   */
  lowBandwidth: {
    targetResolution: { width: 640, height: 480 },
    maxBitrate: 800000,  // 800 Kbps
    minBitrate: 150000,  // 150 Kbps minimum
    frameRate: 15,
    preferredCodec: 'VP8' as const,
  },
} as const;

export type VideoQualityPreset = keyof typeof VIDEO_QUALITY_PRESETS;

/**
 * Audio quality settings for medical consultations
 * Clear audio is critical for patient-doctor communication
 */
export const AUDIO_QUALITY_SETTINGS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1, // Mono for voice
} as const;

/**
 * Stream call settings optimized for medical consultations
 * Requirements: 8.5
 */
export interface StreamCallSettings {
  audio: {
    mic_default_on: boolean;
    speaker_default_on: boolean;
    default_device?: string;
  };
  video: {
    camera_default_on: boolean;
    target_resolution?: { width: number; height: number };
  };
  screenshare: {
    enabled: boolean;
    access_request_enabled: boolean;
  };
  recording: {
    mode: 'disabled' | 'available' | 'auto-on';
  };
}

/**
 * Default call settings for medical consultations
 */
export const DEFAULT_MEDICAL_CALL_SETTINGS: StreamCallSettings = {
  audio: {
    mic_default_on: true,
    speaker_default_on: true,
  },
  video: {
    camera_default_on: true,
    target_resolution: VIDEO_QUALITY_PRESETS.medical.targetResolution,
  },
  screenshare: {
    enabled: true,
    access_request_enabled: false, // Doctors can share without request
  },
  recording: {
    mode: 'available', // Recording available but not auto-started
  },
};

/**
 * Get video quality preset based on network conditions
 * @param connectionQuality - Network quality indicator (0-1)
 * @returns Appropriate video quality preset
 */
export function getVideoQualityForConnection(connectionQuality: number): VideoQualityPreset {
  if (connectionQuality >= 0.7) {
    return 'medical';
  } else if (connectionQuality >= 0.4) {
    return 'standard';
  }
  return 'lowBandwidth';
}

/**
 * Validate video quality configuration
 * @param config - Video quality configuration to validate
 * @returns true if configuration is valid
 */
export function isValidVideoQualityConfig(config: typeof VIDEO_QUALITY_PRESETS[VideoQualityPreset]): boolean {
  if (!config) return false;
  
  const { targetResolution, maxBitrate, minBitrate, frameRate } = config;
  
  // Validate resolution
  if (!targetResolution || targetResolution.width <= 0 || targetResolution.height <= 0) {
    return false;
  }
  
  // Validate bitrate
  if (maxBitrate <= 0 || minBitrate <= 0 || minBitrate > maxBitrate) {
    return false;
  }
  
  // Validate frame rate
  if (frameRate <= 0 || frameRate > 60) {
    return false;
  }
  
  return true;
}

/**
 * Get call settings for a specific quality preset
 * @param preset - Video quality preset name
 * @returns Stream call settings configured for the preset
 */
export function getCallSettingsForPreset(preset: VideoQualityPreset): StreamCallSettings {
  const qualityConfig = VIDEO_QUALITY_PRESETS[preset];
  
  return {
    ...DEFAULT_MEDICAL_CALL_SETTINGS,
    video: {
      ...DEFAULT_MEDICAL_CALL_SETTINGS.video,
      target_resolution: qualityConfig.targetResolution,
    },
  };
}

/**
 * Resource cleanup configuration
 * Requirements: 8.2 - Proper resource cleanup when leaving meetings
 */
export const RESOURCE_CLEANUP_CONFIG = {
  /**
   * Timeout for graceful disconnect (ms)
   */
  disconnectTimeout: 5000,
  
  /**
   * Whether to stop local tracks on leave
   */
  stopTracksOnLeave: true,
  
  /**
   * Whether to release media devices on leave
   */
  releaseDevicesOnLeave: true,
} as const;

/**
 * Client initialization configuration
 * Requirements: 8.1 - Initialize Stream client only when needed
 */
export const CLIENT_INIT_CONFIG = {
  /**
   * Delay before initializing client (ms)
   * Allows for lazy initialization
   */
  initDelay: 0,
  
  /**
   * Whether to initialize client on mount
   */
  initOnMount: true,
  
  /**
   * Whether to reconnect automatically on disconnect
   */
  autoReconnect: true,
  
  /**
   * Maximum reconnection attempts
   */
  maxReconnectAttempts: 3,
} as const;
