/**
 * Feature: stream-video-integration, Property 2: User Identity Mapping
 * 
 * For any authenticated Clerk user, the Stream Video Client should use the Clerk user ID 
 * as the Stream user identifier, and the Stream Token Provider should generate a valid JWT token
 * 
 * Validates: Requirements 1.2, 1.5
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

// Arbitrary generators for user IDs and call IDs
const arbitraryUserId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const arbitraryCallId = fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined });

describe('Property 2: User Identity Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful token generation
    mockGenerateUserToken.mockReturnValue('mock_jwt_token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates valid tokens for any authenticated user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryCallId,
        async (userId, callId) => {
          const result = await streamService.generateToken({ userId, callId });
          
          // Token should be a non-empty string
          expect(result.token).toBe('mock_jwt_token');
          expect(typeof result.token).toBe('string');
          expect(result.token.length).toBeGreaterThan(0);
          
          // ExpiresAt should be a future timestamp
          expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
          
          // Should have called generateUserToken with correct parameters
          expect(mockGenerateUserToken).toHaveBeenCalledWith({
            user_id: userId,
            exp: expect.any(Number)
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uses Clerk user ID as Stream user identifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          await streamService.generateToken({ userId });
          
          // Verify that the user ID passed to Stream matches the Clerk user ID
          expect(mockGenerateUserToken).toHaveBeenCalledWith({
            user_id: userId,
            exp: expect.any(Number)
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates tokens with consistent expiration time (24 hours)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          const beforeTime = Math.floor(Date.now() / 1000);
          const result = await streamService.generateToken({ userId });
          const afterTime = Math.floor(Date.now() / 1000);
          
          // Token should expire approximately 24 hours from now (86400 seconds)
          const expectedMinExpiry = beforeTime + (24 * 60 * 60);
          const expectedMaxExpiry = afterTime + (24 * 60 * 60);
          
          expect(result.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
          expect(result.expiresAt).toBeLessThanOrEqual(expectedMaxExpiry);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles optional call ID parameter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryCallId,
        async (userId, callId) => {
          const result = await streamService.generateToken({ userId, callId });
          
          // Should generate token regardless of whether callId is provided
          expect(result.token).toBe('mock_jwt_token');
          expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
          
          // The callId parameter doesn't affect token generation in current implementation
          // but should be accepted without errors
        }
      ),
      { numRuns: 100 }
    );
  });

  it('token generation is deterministic for same user and expiration time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        async (userId) => {
          // Mock to return the same token for same input
          mockGenerateUserToken.mockReturnValue('consistent_token');
          
          const result1 = await streamService.generateToken({ userId });
          const result2 = await streamService.generateToken({ userId });
          
          // Both calls should produce the same token (mocked behavior)
          expect(result1.token).toBe(result2.token);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('service reports configuration status correctly', () => {
    // With mocked environment, service should be configured
    expect(streamService.isConfigured()).toBe(true);
  });
});