/**
 * Feature: stream-video-integration, Property 16: Resource Management
 * Validates: Requirements 8.1, 8.2, 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  VIDEO_QUALITY_PRESETS,
  RESOURCE_CLEANUP_CONFIG,
  CLIENT_INIT_CONFIG,
  isValidVideoQualityConfig,
  getVideoQualityForConnection,
  getCallSettingsForPreset,
  type VideoQualityPreset,
} from '@/server/services/stream-video-config';

describe('Property 16: Resource Management', () => {
  describe('Requirements 8.1: Initialize Stream client only when needed', () => {
    it('CLIENT_INIT_CONFIG has valid init delay', () => {
      expect(CLIENT_INIT_CONFIG.initDelay).toBeGreaterThanOrEqual(0);
    });

    it('CLIENT_INIT_CONFIG has valid reconnection settings', () => {
      expect(CLIENT_INIT_CONFIG.maxReconnectAttempts).toBeGreaterThan(0);
      expect(CLIENT_INIT_CONFIG.maxReconnectAttempts).toBeLessThanOrEqual(10);
    });

    it('CLIENT_INIT_CONFIG has auto reconnect setting', () => {
      expect(typeof CLIENT_INIT_CONFIG.autoReconnect).toBe('boolean');
    });
  });

  describe('Requirements 8.2: Proper resource cleanup when leaving meetings', () => {
    it('RESOURCE_CLEANUP_CONFIG has valid disconnect timeout', () => {
      expect(RESOURCE_CLEANUP_CONFIG.disconnectTimeout).toBeGreaterThan(0);
      expect(RESOURCE_CLEANUP_CONFIG.disconnectTimeout).toBeLessThanOrEqual(30000);
    });

    it('RESOURCE_CLEANUP_CONFIG enables track stopping on leave', () => {
      expect(RESOURCE_CLEANUP_CONFIG.stopTracksOnLeave).toBe(true);
    });

    it('RESOURCE_CLEANUP_CONFIG enables device release on leave', () => {
      expect(RESOURCE_CLEANUP_CONFIG.releaseDevicesOnLeave).toBe(true);
    });
  });

  describe('Requirements 8.4: Video quality presets', () => {
    it('for any video quality preset, configuration should be valid', () => {
      const presetNames: VideoQualityPreset[] = ['medical', 'standard', 'lowBandwidth'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...presetNames),
          (presetName) => {
            const config = VIDEO_QUALITY_PRESETS[presetName];
            expect(config).toBeDefined();
            expect(config.targetResolution.width).toBeGreaterThan(0);
            expect(config.targetResolution.height).toBeGreaterThan(0);
            expect(config.maxBitrate).toBeGreaterThan(0);
            expect(config.minBitrate).toBeGreaterThan(0);
            expect(config.minBitrate).toBeLessThanOrEqual(config.maxBitrate);
            expect(config.frameRate).toBeGreaterThan(0);
            expect(config.frameRate).toBeLessThanOrEqual(60);
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('isValidVideoQualityConfig correctly validates configurations', () => {
      fc.assert(
        fc.property(
          fc.record({
            targetResolution: fc.record({
              width: fc.integer({ min: 1, max: 4096 }),
              height: fc.integer({ min: 1, max: 2160 }),
            }),
            maxBitrate: fc.integer({ min: 100000, max: 10000000 }),
            minBitrate: fc.integer({ min: 50000, max: 5000000 }),
            frameRate: fc.integer({ min: 1, max: 60 }),
            preferredCodec: fc.constant('VP8' as const),
          }),
          (config) => {
            const validConfig = {
              ...config,
              minBitrate: Math.min(config.minBitrate, config.maxBitrate),
            };
            const isValid = isValidVideoQualityConfig(validConfig as any);
            expect(isValid).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidVideoQualityConfig rejects invalid configurations', () => {
      expect(isValidVideoQualityConfig({
        targetResolution: { width: 0, height: 720 },
        maxBitrate: 1500000,
        minBitrate: 300000,
        frameRate: 30,
        preferredCodec: 'VP8',
      } as any)).toBe(false);

      expect(isValidVideoQualityConfig({
        targetResolution: { width: 1280, height: 720 },
        maxBitrate: 100000,
        minBitrate: 500000,
        frameRate: 30,
        preferredCodec: 'VP8',
      } as any)).toBe(false);
    });

    it('getVideoQualityForConnection returns appropriate preset', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1, noNaN: true }),
          (connectionQuality) => {
            const preset = getVideoQualityForConnection(connectionQuality);
            expect(['medical', 'standard', 'lowBandwidth']).toContain(preset);
            if (connectionQuality >= 0.7) {
              expect(preset).toBe('medical');
            } else if (connectionQuality >= 0.4) {
              expect(preset).toBe('standard');
            } else {
              expect(preset).toBe('lowBandwidth');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getCallSettingsForPreset returns valid settings', () => {
      const presetNames: VideoQualityPreset[] = ['medical', 'standard', 'lowBandwidth'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...presetNames),
          (presetName) => {
            const settings = getCallSettingsForPreset(presetName);
            expect(settings.audio).toBeDefined();
            expect(settings.video).toBeDefined();
            expect(settings.screenshare).toBeDefined();
            expect(settings.recording).toBeDefined();
            expect(typeof settings.audio.mic_default_on).toBe('boolean');
            expect(typeof settings.video.camera_default_on).toBe('boolean');
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('medical preset has highest quality settings', () => {
      const medical = VIDEO_QUALITY_PRESETS.medical;
      const standard = VIDEO_QUALITY_PRESETS.standard;
      const lowBandwidth = VIDEO_QUALITY_PRESETS.lowBandwidth;
      
      expect(medical.maxBitrate).toBeGreaterThanOrEqual(standard.maxBitrate);
      expect(standard.maxBitrate).toBeGreaterThanOrEqual(lowBandwidth.maxBitrate);
    });
  });
});
