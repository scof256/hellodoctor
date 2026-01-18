/**
 * Integration Test: Complete Logout Flow
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4
 * 
 * Tests complete logout functionality including:
 * - Logout from settings page
 * - Logout from UserButton
 * - Redirect behavior for all roles
 * - Confirmation dialog flow
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, SignOutButton } from '@clerk/nextjs';
import { SimplifiedSettings } from '@/app/components/SimplifiedSettings';
import { getLogoutRedirectUrl } from '@/app/lib/auth-utils';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockPathname = '/patient/settings';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock Clerk
const mockSignOut = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  SignOutButton: ({ children, redirectUrl }: any) => {
    const signOut = mockSignOut;
    return children({ signOut });
  },
  useAuth: vi.fn(),
  UserButton: () => <div data-testid="clerk-userbutton">UserButton</div>,
}));

// Mock ModeContext
vi.mock('@/app/contexts/ModeContext', () => ({
  useMode: () => ({
    mode: 'simple',
    isSimpleMode: () => true,
    toggleMode: vi.fn(),
  }),
}));

// Mock localization
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
    currentLanguage: 'en',
    setLanguage: vi.fn(),
  }),
}));

// Mock tutorial
vi.mock('@/app/hooks/useTutorial', () => ({
  useTutorial: () => ({
    showTutorialAgain: vi.fn(),
  }),
}));

// Mock Toast
vi.mock('@/app/components/Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe('Complete Logout Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockSignOut.mockClear();
    
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
    });
    
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(mockPathname);
    
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });
  });

  describe('Logout from Settings Page', () => {
    it('should display logout button in settings', () => {
      const mockLogout = vi.fn();
      
      render(<SimplifiedSettings onLogout={mockLogout} />);
      
      // Should display logout button (Requirement 2.1)
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      expect(logoutButton).toBeDefined();
    });

    it('should show confirmation dialog when logout is clicked', async () => {
      const mockLogout = vi.fn();
      
      render(<SimplifiedSettings onLogout={mockLogout} />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Should show confirmation dialog (Requirement 2.2)
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
        expect(screen.getByText(/settings\.logoutConfirmMessage/i)).toBeDefined();
      });
    });

    it('should call signOut when logout is confirmed', async () => {
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      
      render(<SimplifiedSettings onLogout={mockLogout} />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Click confirm button
      const confirmButtons = screen.getAllByRole('button', { name: /settings\.logoutButton/i });
      const confirmButton = confirmButtons[confirmButtons.length - 1]; // Get the confirm button in dialog
      fireEvent.click(confirmButton);
      
      // Should invoke signOut function (Requirement 2.3)
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('should close dialog and maintain session when logout is cancelled', async () => {
      const mockLogout = vi.fn();
      
      render(<SimplifiedSettings onLogout={mockLogout} />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /common\.cancel/i });
      fireEvent.click(cancelButton);
      
      // Dialog should close and logout should not be called (Requirement 2.5)
      await waitFor(() => {
        expect(screen.queryByText(/settings\.logoutConfirmTitle/i)).toBeNull();
      });
      expect(mockLogout).not.toHaveBeenCalled();
    });

    it('should handle logout errors gracefully', async () => {
      const mockLogout = vi.fn().mockRejectedValue(new Error('Network error'));
      
      render(<SimplifiedSettings onLogout={mockLogout} />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Click confirm button
      const confirmButtons = screen.getAllByRole('button', { name: /settings\.logoutButton/i });
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      fireEvent.click(confirmButton);
      
      // Should handle error and close dialog (Requirement 5.5)
      // The error is logged to console and toast is shown
      await waitFor(() => {
        expect(screen.queryByText(/settings\.logoutConfirmTitle/i)).toBeNull();
      });
      
      // Verify logout was attempted
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Logout Redirect Behavior', () => {
    it('should redirect patient to sign-in page after logout', () => {
      // Test patient path
      const patientPath = '/patient/settings';
      const redirectUrl = getLogoutRedirectUrl(patientPath);
      
      // Should redirect to sign-in (Requirement 5.3)
      expect(redirectUrl).toBe('/sign-in');
    });

    it('should redirect doctor to home page after logout', () => {
      // Test doctor path
      const doctorPath = '/doctor/appointments';
      const redirectUrl = getLogoutRedirectUrl(doctorPath);
      
      // Should redirect to home (Requirement 5.4)
      expect(redirectUrl).toBe('/');
    });

    it('should redirect admin to home page after logout', () => {
      // Test admin path
      const adminPath = '/admin/users';
      const redirectUrl = getLogoutRedirectUrl(adminPath);
      
      // Should redirect to home (Requirement 5.4)
      expect(redirectUrl).toBe('/');
    });
  });

  describe('UserButton Logout Flow', () => {
    it('should provide UserButton with correct redirect URL for patients', () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/patient');
      
      const redirectUrl = getLogoutRedirectUrl('/patient');
      
      // UserButton should redirect patients to sign-in (Requirement 4.3, 5.3)
      expect(redirectUrl).toBe('/sign-in');
    });

    it('should provide UserButton with correct redirect URL for doctors', () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/doctor');
      
      const redirectUrl = getLogoutRedirectUrl('/doctor');
      
      // UserButton should redirect doctors to home (Requirement 4.3, 5.4)
      expect(redirectUrl).toBe('/');
    });

    it('should provide UserButton with correct redirect URL for admins', () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/admin');
      
      const redirectUrl = getLogoutRedirectUrl('/admin');
      
      // UserButton should redirect admins to home (Requirement 4.3, 5.4)
      expect(redirectUrl).toBe('/');
    });
  });

  describe('Complete End-to-End Logout Flow', () => {
    it('should complete full logout flow for patient from settings', async () => {
      // Mock successful signOut
      mockSignOut.mockResolvedValue(undefined);
      
      // Create a wrapper component that simulates the patient settings page
      const PatientSettingsWrapper = () => {
        const router = useRouter();
        const pathname = usePathname();
        
        const handleLogout = async (signOut: () => Promise<void>) => {
          await signOut();
          const redirectUrl = getLogoutRedirectUrl(pathname);
          router.push(redirectUrl);
        };
        
        return (
          <SignOutButton redirectUrl={getLogoutRedirectUrl(pathname)}>
            {({ signOut }: { signOut: () => Promise<void> }) => (
              <SimplifiedSettings onLogout={() => handleLogout(signOut)} />
            )}
          </SignOutButton>
        );
      };
      
      render(<PatientSettingsWrapper />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Confirm logout
      const confirmButtons = screen.getAllByRole('button', { name: /settings\.logoutButton/i });
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      fireEvent.click(confirmButton);
      
      // Should call signOut and redirect (Requirements 2.3, 2.4, 5.1, 5.2, 5.3)
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/sign-in');
      });
    });

    it('should complete full logout flow for doctor from settings', async () => {
      // Mock doctor pathname
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/doctor/appointments');
      
      // Mock successful signOut
      mockSignOut.mockResolvedValue(undefined);
      
      // Create a wrapper component that simulates the doctor settings page
      const DoctorSettingsWrapper = () => {
        const router = useRouter();
        const pathname = usePathname();
        
        const handleLogout = async (signOut: () => Promise<void>) => {
          await signOut();
          const redirectUrl = getLogoutRedirectUrl(pathname);
          router.push(redirectUrl);
        };
        
        return (
          <SignOutButton redirectUrl={getLogoutRedirectUrl(pathname)}>
            {({ signOut }: { signOut: () => Promise<void> }) => (
              <SimplifiedSettings onLogout={() => handleLogout(signOut)} />
            )}
          </SignOutButton>
        );
      };
      
      render(<DoctorSettingsWrapper />);
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /settings\.logoutButton/i });
      fireEvent.click(logoutButton);
      
      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Confirm logout
      const confirmButtons = screen.getAllByRole('button', { name: /settings\.logoutButton/i });
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      fireEvent.click(confirmButton);
      
      // Should call signOut and redirect to home (Requirements 2.3, 5.1, 5.2, 5.4)
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });
});
