/**
 * Integration Test: Sign-In Redirect Behavior
 * Validates: Requirements 6.3, 6.4, 6.5
 * 
 * Tests that sign-in redirects users to the appropriate dashboard based on their role
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk SignIn Component</div>,
  useAuth: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page';

describe('Sign-In Redirect Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
    });
    
    (useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: (key: string) => mockSearchParams.get(key),
    });
  });

  it('should redirect patient to patient dashboard after sign-in', async () => {
    // Mock patient user
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Mock API response for patient
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ role: 'patient' }),
    });

    render(<SignInPage />);

    // Should show loading state
    expect(screen.getByText(/signing you in/i)).toBeDefined();

    // Wait for redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/patient');
    }, { timeout: 3000 });
  });

  it('should redirect doctor to doctor dashboard after sign-in', async () => {
    // Mock doctor user
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Mock API response for doctor
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ role: 'doctor' }),
    });

    render(<SignInPage />);

    // Should show loading state
    expect(screen.getByText(/signing you in/i)).toBeDefined();

    // Wait for redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/doctor');
    }, { timeout: 3000 });
  });

  it('should redirect admin to admin dashboard after sign-in', async () => {
    // Mock admin user
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Mock API response for admin
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ role: 'super_admin' }),
    });

    render(<SignInPage />);

    // Should show loading state
    expect(screen.getByText(/signing you in/i)).toBeDefined();

    // Wait for redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    }, { timeout: 3000 });
  });

  it('should redirect to onboarding if user does not exist in database', async () => {
    // Mock new user
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Mock API response for non-existent user
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    render(<SignInPage />);

    // Should show loading state
    expect(screen.getByText(/signing you in/i)).toBeDefined();

    // Wait for redirect to onboarding
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    }, { timeout: 3000 });
  });

  it('should handle role parameter from get-started flow', async () => {
    // Mock user with role parameter
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Set role parameter
    mockSearchParams.set('role', 'doctor');
    (useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: (key: string) => key === 'role' ? 'doctor' : null,
    });

    // Mock API response for profile creation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ redirectTo: '/doctor' }),
    });

    render(<SignInPage />);

    // Wait for redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/doctor');
    }, { timeout: 3000 });

    // Verify onboarding API was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/onboarding',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ role: 'doctor' }),
      })
    );
  });

  it('should display sign-in form when user is not authenticated', () => {
    // Mock unauthenticated user
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
    });

    render(<SignInPage />);

    // Should show sign-in form
    expect(screen.getByTestId('clerk-signin')).toBeDefined();
    expect(screen.getByText(/welcome back/i)).toBeDefined();
    expect(screen.getByText(/sign in to access your dashboard/i)).toBeDefined();
  });

  it('should handle redirect_url parameter for doctor connection flow', async () => {
    // Mock user with redirect_url parameter
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    // Set redirect_url parameter
    const redirectUrl = '/connect/doctor-slug';
    (useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: (key: string) => key === 'redirect_url' ? redirectUrl : null,
    });

    render(<SignInPage />);

    // Wait for redirect to doctor connection page
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(redirectUrl);
    }, { timeout: 3000 });
  });
});
