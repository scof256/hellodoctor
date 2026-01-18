/**
 * Integration Test: Complete Sign-In Flow
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 * 
 * Tests complete sign-in functionality including:
 * - Sign-in access from public pages
 * - Navigation to sign-in page
 * - Dashboard redirect for different roles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(() => '/'),
}));

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk SignIn Component</div>,
  useAuth: vi.fn(),
  UserButton: () => <div data-testid="clerk-userbutton">UserButton</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>{children}</a>
  ),
}));

import LandingPage from '@/app/(public)/page';
import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page';

describe('Complete Sign-In Flow Integration Tests', () => {
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

  describe('Sign-In Access from Public Pages', () => {
    it('should display sign-in button on public home page', () => {
      // Mock unauthenticated user
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      render(<LandingPage />);

      // Should display sign-in links/buttons (Requirement 6.1)
      const signInLinks = screen.getAllByText(/sign in/i);
      expect(signInLinks.length).toBeGreaterThan(0);
      
      // Verify at least one is a link to /sign-in
      const signInLink = signInLinks.find(link => 
        link.closest('a')?.getAttribute('href') === '/sign-in'
      );
      expect(signInLink).toBeDefined();
    });

    it('should navigate to sign-in page when sign-in button is clicked', () => {
      // Mock unauthenticated user
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      render(<LandingPage />);

      // Find and verify sign-in link
      const signInLinks = screen.getAllByText(/sign in/i);
      const navSignInLink = signInLinks[0]; // First one in nav
      
      // Verify it links to /sign-in (Requirement 6.2)
      const linkElement = navSignInLink.closest('a');
      expect(linkElement?.getAttribute('href')).toBe('/sign-in');
    });

    it('should display multiple sign-in access points on public page', () => {
      // Mock unauthenticated user
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      render(<LandingPage />);

      // Should have multiple sign-in access points for better UX (Requirement 6.1)
      const signInLinks = screen.getAllByText(/sign in/i);
      expect(signInLinks.length).toBeGreaterThanOrEqual(2); // At least in nav and hero section
    });

    it('should redirect authenticated users away from public page', () => {
      // Mock authenticated user
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
      });

      render(<LandingPage />);

      // Should redirect authenticated users (Requirement 6.3)
      waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/patient');
      });
    });
  });

  describe('Sign-In Page and Dashboard Redirect', () => {
    it('should display sign-in form when user is not authenticated', () => {
      // Mock unauthenticated user
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      render(<SignInPage />);

      // Should show sign-in form (Requirement 6.2)
      expect(screen.getByTestId('clerk-signin')).toBeDefined();
      expect(screen.getByText(/welcome back/i)).toBeDefined();
      expect(screen.getByText(/sign in to access your dashboard/i)).toBeDefined();
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

      // Wait for redirect to patient dashboard (Requirement 6.4)
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

      // Wait for redirect to doctor dashboard (Requirement 6.5)
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

      // Wait for redirect to admin dashboard (Requirement 6.5)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      }, { timeout: 3000 });
    });
  });

  describe('Complete End-to-End Sign-In Flow', () => {
    it('should complete full flow from public page to patient dashboard', async () => {
      // Step 1: User visits public page (unauthenticated)
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      const { unmount } = render(<LandingPage />);

      // Verify sign-in button is visible (Requirement 6.1)
      const signInLinks = screen.getAllByText(/sign in/i);
      expect(signInLinks.length).toBeGreaterThan(0);

      // Verify link navigates to /sign-in (Requirement 6.2)
      const linkElement = signInLinks[0].closest('a');
      expect(linkElement?.getAttribute('href')).toBe('/sign-in');

      unmount();

      // Step 2: User navigates to sign-in page
      render(<SignInPage />);

      // Should show sign-in form
      expect(screen.getByTestId('clerk-signin')).toBeDefined();

      unmount();

      // Step 3: User signs in and gets redirected
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

      // Should redirect to patient dashboard (Requirements 6.3, 6.4)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/patient');
      }, { timeout: 3000 });
    });

    it('should complete full flow from public page to doctor dashboard', async () => {
      // Step 1: User visits public page (unauthenticated)
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
      });

      const { unmount } = render(<LandingPage />);

      // Verify sign-in button is visible (Requirement 6.1)
      const signInLinks = screen.getAllByText(/sign in/i);
      expect(signInLinks.length).toBeGreaterThan(0);

      unmount();

      // Step 2: User navigates to sign-in page
      render(<SignInPage />);

      // Should show sign-in form
      expect(screen.getByTestId('clerk-signin')).toBeDefined();

      unmount();

      // Step 3: User signs in as doctor and gets redirected
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

      // Should redirect to doctor dashboard (Requirements 6.3, 6.5)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/doctor');
      }, { timeout: 3000 });
    });

    it('should handle new user onboarding flow', async () => {
      // Mock new user (not in database)
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

      // Should redirect to onboarding
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/onboarding');
      }, { timeout: 3000 });
    });
  });
});
