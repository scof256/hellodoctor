/**
 * Feature: stream-video-integration, Property 17: Video Quality Configuration
 * 
 * For any medical consultation video call, the system should configure
 * appropriate video quality settings that prioritize clarity for visual
 * assessments while adapting to network conditions.
 * 
 * Validates: Requirements 8.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  VIDEO_QUALITY_PRESETS,
  AUDIO_QUALITY_SETTINGS,
  DEFAULT_MEDICAL_CALL_SETTINGS,
  isValidVideoQualityConfig,
  getVideoQualityForConnection,
  getCallSettingsForPreset,
  type VideoQualityPreset,
  type StreamCallSettings,
} from '@/server/services/stream-video-config';

describe('Property 17: Video Quality Configuration', () => {
  describe('Requirements 8.5: Configure video quality settings for medical consultations', () => {
    it('medical preset prioritizes clarity with high resolution and bitrate', () => {
      const medical = VIDEO_QUALITY_PRESETS.medical;
      
      // Medical preset should have HD resolution (720p or higher)
      expect(medical.targetResolution.width).toBeGreaterThanOrEqual(1280);
      expect(medical.targetResolution.height).toBeGreaterThanOrEqual(720);
      
      // Medical preset should have high bitrate for clarity
      expect(medical.maxBitrate).toBeGreaterThanOrEqual(2000000); // At least 2 Mbps
      
      // Medical preset should have smooth frame rate
      expect(medical.frameRate).toBeGreaterThanOrEqual(24);
    });

    it('audio settings are optimized for voice clarity', () => {
      // Echo cancellation should be enabled for clear communication
      expect(AUDIO_QUALITY_SETTINGS.echoCancellation).toBe(true);
      
      // Noise suppression should be enabled
      expect(AUDIO_QUALITY_SETTINGS.noiseSuppression).toBe(true);
      
      // Auto gain control should be enabled
      expect(AUDIO_QUALITY_SETTINGS.autoGainControl).toBe(true);
      
      // Sample rate should be high quality
      expect(AUDIO_QUALITY_SETTINGS.sampleRate).toBeGreaterThanOrEqual(44100);
    });


    it('default medical call settings enable camera and microphone', () => {
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.audio.mic_default_on).toBe(true);
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.audio.speaker_default_on).toBe(true);
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.video.camera_default_on).toBe(true);
    });

    it('default medical call settings use medical quality resolution', () => {
      const medicalResolution = VIDEO_QUALITY_PRESETS.medical.targetResolution;
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.video.target_resolution).toEqual(medicalResolution);
    });

    it('screen sharing is enabled for medical consultations', () => {
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.screenshare.enabled).toBe(true);
    });

    it('recording is available but not auto-started for privacy', () => {
      expect(DEFAULT_MEDICAL_CALL_SETTINGS.recording.mode).toBe('available');
    });

    it('for any connection quality, appropriate preset is selected', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1, noNaN: true }),
          (connectionQuality) => {
            const preset = getVideoQualityForConnection(connectionQuality);
            const config = VIDEO_QUALITY_PRESETS[preset];
            
            // Higher connection quality should result in higher bitrate presets
            if (connectionQuality >= 0.7) {
              expect(config.maxBitrate).toBeGreaterThanOrEqual(2000000);
            } else if (connectionQuality >= 0.4) {
              expect(config.maxBitrate).toBeGreaterThanOrEqual(1000000);
            } else {
              // Low bandwidth should still be usable
              expect(config.maxBitrate).toBeGreaterThan(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all presets maintain minimum quality for medical use', () => {
      const presetNames: VideoQualityPreset[] = ['medical', 'standard', 'lowBandwidth'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...presetNames),
          (presetName) => {
            const config = VIDEO_QUALITY_PRESETS[presetName];
            
            // All presets should have at least VGA resolution
            expect(config.targetResolution.width).toBeGreaterThanOrEqual(640);
            expect(config.targetResolution.height).toBeGreaterThanOrEqual(480);
            
            // All presets should have reasonable frame rate
            expect(config.frameRate).toBeGreaterThanOrEqual(15);
            
            // All presets should use VP8 codec for compatibility
            expect(config.preferredCodec).toBe('VP8');
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('call settings for any preset include all required fields', () => {
      const presetNames: VideoQualityPreset[] = ['medical', 'standard', 'lowBandwidth'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...presetNames),
          (presetName) => {
            const settings = getCallSettingsForPreset(presetName);
            
            // Audio settings
            expect(settings.audio).toBeDefined();
            expect(typeof settings.audio.mic_default_on).toBe('boolean');
            expect(typeof settings.audio.speaker_default_on).toBe('boolean');
            
            // Video settings
            expect(settings.video).toBeDefined();
            expect(typeof settings.video.camera_default_on).toBe('boolean');
            expect(settings.video.target_resolution).toBeDefined();
            expect(settings.video.target_resolution?.width).toBeGreaterThan(0);
            expect(settings.video.target_resolution?.height).toBeGreaterThan(0);
            
            // Screen share settings
            expect(settings.screenshare).toBeDefined();
            expect(typeof settings.screenshare.enabled).toBe('boolean');
            
            // Recording settings
            expect(settings.recording).toBeDefined();
            expect(['disabled', 'available', 'auto-on']).toContain(settings.recording.mode);
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('preset quality degrades gracefully with connection quality', () => {
      // Test boundary conditions
      const highQuality = getVideoQualityForConnection(0.9);
      const mediumQuality = getVideoQualityForConnection(0.5);
      const lowQuality = getVideoQualityForConnection(0.2);
      
      const highConfig = VIDEO_QUALITY_PRESETS[highQuality];
      const mediumConfig = VIDEO_QUALITY_PRESETS[mediumQuality];
      const lowConfig = VIDEO_QUALITY_PRESETS[lowQuality];
      
      // Higher quality should have higher or equal bitrate
      expect(highConfig.maxBitrate).toBeGreaterThanOrEqual(mediumConfig.maxBitrate);
      expect(mediumConfig.maxBitrate).toBeGreaterThanOrEqual(lowConfig.maxBitrate);
    });

    it('video quality validation rejects configurations with invalid bitrate ratios', () => {
      // minBitrate should not exceed maxBitrate
      const invalidConfig = {
        targetResolution: { width: 1280, height: 720 },
        maxBitrate: 500000,
        minBitrate: 1000000, // Invalid: min > max
        frameRate: 30,
        preferredCodec: 'VP8' as const,
      };
      
      expect(isValidVideoQualityConfig(invalidConfig)).toBe(false);
    });

    it('video quality validation accepts all preset configurations', () => {
      const presetNames: VideoQualityPreset[] = ['medical', 'standard', 'lowBandwidth'];
      
      for (const presetName of presetNames) {
        const config = VIDEO_QUALITY_PRESETS[presetName];
        expect(isValidVideoQualityConfig(config)).toBe(true);
      }
    });
  });
});
