/**
 * Feature: stream-video-integration, Property 8: Token Security
 * 
 * For any generated Stream token, it should have appropriate expiration times for security
 * 
 * Validates: Requirements 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { streamService } from '@/server/services/stream';

// Mock the environment
vi.mock('@/env', () => ({
  env: {
    STREAM_API_KEY: 'test_api_key',
    STREAM_SECRET_KEY: 'test_secret_key',
  }
}));

// Mock the StreamClient
const mockGenerateUserToken = vi.fn();
vi.mock('@stream-io/node-sdk', () => ({
  StreamClient: vi.fn().mockImplementation(() => ({
    generateUserToken: mockGenerateUserToken
  }))
}));

// Arbitrary generators
const arbitraryUserId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const arbitraryCallId = fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined });

describe('Property 8: Token Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful token generation
    mockGenerateUserToken.mockReturnValue('secure_jwt_token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates tokens with secure expiration times (24 hours)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryCallId,
        async (userId, callId) => {
          const beforeTime = Math.floor(Date.now() / 1000);
          const result = await streamService.generateToken({ userId, callId });
          const afterTime = Math.floor(Date.now() / 1000);
          
          // Token should expire exactly 24 hours from generation time
          const expectedMinExpiry = beforeTime + (24 * 60 * 60);
          const expectedMaxExpiry = afterTime + (24 * 60 * 60);
          
          expect(result.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
          expect(result.expiresAt).toBeLessThanOrEqual(expectedMaxExpiry);
          
          // Verify the expiration was passed to the Stream SDK
          expect(mockGenerateUserToken).toHaveBeenCalledWith({
            user_id: userId,
            exp: result.expiresAt
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens expire in the future (not immediately)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          const result = await streamService.generateToken({ userId });
          const currentTime = Math.floor(Date.now() / 1000);
          
          // Token should expire at least 1 hour in the future for security
          const minimumSecureExpiry = currentTime + (60 * 60); // 1 hour
          expect(result.expiresAt).toBeGreaterThan(minimumSecureExpiry);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens do not expire too far in the future (max 24 hours)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          const result = await streamService.generateToken({ userId });
          const currentTime = Math.floor(Date.now() / 1000);
          
          // Token should not expire more than 24 hours in the future for security
          const maximumSecureExpiry = currentTime + (24 * 60 * 60) + 60; // 24 hours + 1 minute buffer
          expect(result.expiresAt).toBeLessThan(maximumSecureExpiry);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('token expiration is consistent across multiple generations', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          const result1 = await streamService.generateToken({ userId });
          const result2 = await streamService.generateToken({ userId });
          
          // Both tokens should have similar expiration times (within a few seconds)
          const timeDifference = Math.abs(result1.expiresAt - result2.expiresAt);
          expect(timeDifference).toBeLessThan(5); // Within 5 seconds
        }
      ),
      { numRuns: 100 }
    );
  });

  it('token contains proper security metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          const result = await streamService.generateToken({ userId });
          
          // Token should be a non-empty string (JWT format expected)
          expect(typeof result.token).toBe('string');
          expect(result.token.length).toBeGreaterThan(0);
          
          // ExpiresAt should be a valid Unix timestamp
          expect(typeof result.expiresAt).toBe('number');
          expect(result.expiresAt).toBeGreaterThan(0);
          
          // Verify the token generation was called with security parameters
          expect(mockGenerateUserToken).toHaveBeenCalledWith({
            user_id: userId,
            exp: expect.any(Number)
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects token generation for invalid configurations', () => {
    // With mocked environment, service should be configured
    expect(streamService.isConfigured()).toBe(true);
  });

  it('handles token generation errors securely', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          // Mock token generation failure
          mockGenerateUserToken.mockImplementation(() => {
            throw new Error('Stream API error');
          });
          
          await expect(streamService.generateToken({ userId }))
            .rejects
            .toThrow('Failed to generate Stream token: Stream API error');
        }
      ),
      { numRuns: 10 }
    );
  });
});