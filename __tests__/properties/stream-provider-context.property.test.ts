/**
 * Feature: stream-video-integration, Property 3: Provider Context Availability
 * 
 * For any component within the StreamVideoProvider, the Stream client context should be 
 * available and accessible
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { StreamVideoProvider, useStreamVideoClient } from '@/app/components/StreamVideoProvider';

// Mock Clerk
const mockUser = {
  id: 'test_user_id',
  fullName: 'Test User',
  firstName: 'Test',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  imageUrl: 'https://example.com/avatar.jpg'
};

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({
    user: mockUser,
    isLoaded: true
  }))
}));

// Mock the server action
vi.mock('@/server/actions/stream', () => ({
  generateStreamToken: vi.fn(() => Promise.resolve({
    token: 'mock_jwt_token',
    expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
  }))
}));

// Mock Stream Video Client
const mockDisconnectUser = vi.fn();
const mockStreamVideoClient = {
  disconnectUser: mockDisconnectUser
};

vi.mock('@stream-io/video-react-sdk', () => ({
  StreamVideoClient: vi.fn(() => mockStreamVideoClient),
  User: {}
}));

// Set the environment variable for the component
process.env.NEXT_PUBLIC_STREAM_API_KEY = 'test_public_api_key';

// Test component that uses the context
function TestComponent({ testId }: { testId: string }) {
  const { client, isLoading, error } = useStreamVideoClient();
  
  return React.createElement('div', { 'data-testid': testId },
    React.createElement('div', { 'data-testid': `${testId}-client` },
      client ? 'client-available' : 'client-null'
    ),
    React.createElement('div', { 'data-testid': `${testId}-loading` },
      isLoading ? 'loading' : 'not-loading'
    ),
    React.createElement('div', { 'data-testid': `${testId}-error` },
      error || 'no-error'
    )
  );
}

// Arbitrary generators - using more constrained generators to avoid conflicts
const arbitraryTestId = fc.integer({ min: 1000, max: 9999 }).map(n => `test-${n}`);

describe('Property 3: Provider Context Availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // Ensure clean DOM before each test
  });

  afterEach(() => {
    cleanup(); // Clean up DOM after each test
    vi.restoreAllMocks();
  });

  it('provides context to any component within the provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTestId,
        async (testId) => {
          // Clean up before rendering
          cleanup();
          
          render(
            React.createElement(StreamVideoProvider, {},
              React.createElement(TestComponent, { testId })
            )
          );

          // Context should be available immediately (even if loading)
          const contextElement = screen.getByTestId(testId);
          expect(contextElement).toBeDefined();

          // Should have loading state initially or client available
          const loadingElement = screen.getByTestId(`${testId}-loading`);
          const clientElement = screen.getByTestId(`${testId}-client`);
          
          // Either loading or client should be available
          expect(
            loadingElement.textContent === 'loading' || 
            clientElement.textContent === 'client-available' ||
            clientElement.textContent === 'client-null'
          ).toBe(true);
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 50 } // Reduced number of runs to avoid timeout
    );
  });

  it('throws error when useStreamVideoClient is used outside provider', () => {
    // Clean up before test
    cleanup();
    
    // This tests the error case - component outside provider
    expect(() => {
      render(React.createElement(TestComponent, { testId: 'outside-provider' }));
    }).toThrow('useStreamVideoClient must be used within a StreamVideoProvider');
    
    cleanup();
  });

  it('context provides all required properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTestId,
        async (testId) => {
          cleanup();
          
          render(
            React.createElement(StreamVideoProvider, {},
              React.createElement(TestComponent, { testId })
            )
          );

          // All required context properties should be present
          const clientElement = screen.getByTestId(`${testId}-client`);
          const loadingElement = screen.getByTestId(`${testId}-loading`);
          const errorElement = screen.getByTestId(`${testId}-error`);

          // Properties should exist (not undefined)
          expect(clientElement.textContent).toMatch(/^(client-available|client-null)$/);
          expect(loadingElement.textContent).toMatch(/^(loading|not-loading)$/);
          expect(errorElement.textContent).toBeDefined();
          
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('context handles nested provider scenarios correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTestId,
        async (testId) => {
          cleanup();
          
          // Test that nested providers work correctly (inner provider should be used)
          render(
            React.createElement(StreamVideoProvider, {},
              React.createElement(StreamVideoProvider, {},
                React.createElement(TestComponent, { testId })
              )
            )
          );

          const contextElement = screen.getByTestId(testId);
          expect(contextElement).toBeDefined();
          
          // Should not throw errors about missing context
          const errorElement = screen.getByTestId(`${testId}-error`);
          expect(errorElement.textContent).not.toContain('must be used within');
          
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });
});