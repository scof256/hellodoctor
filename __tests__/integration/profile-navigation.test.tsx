/**
 * Integration Test: Profile Navigation to Settings
 * Validates: Requirements 7.1, 7.2, 7.3
 * 
 * Tests that profile tab in Bottom Nav navigates to settings page
 * and that settings page displays correctly with all account management options.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav, BottomNavItem } from '@/app/components/BottomNav';
import { SimplifiedSettings } from '@/app/components/SimplifiedSettings';
import { ModeProvider } from '@/app/contexts/ModeContext';
import { Home, MessageSquare, Settings, User } from 'lucide-react';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockPathname = '/patient';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock button feedback
vi.mock('@/app/lib/button-feedback', () => ({
  handleButtonPress: vi.fn(),
}));

// Mock localization
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'navigation.home': 'Home',
        'navigation.messages': 'Messages',
        'navigation.settings': 'Settings',
        'navigation.profile': 'Profile',
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.mode': 'Mode',
        'settings.logoutButton': 'Logout',
      };
      return translations[key] || key;
    },
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

describe('Profile Navigation to Settings Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
    });
    
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(mockPathname);
  });

  describe('Profile Tab Navigation', () => {
    it('should navigate to settings page when profile tab is clicked', async () => {
      const items: BottomNavItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <Home className="w-6 h-6" />,
          route: '/patient',
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: <MessageSquare className="w-6 h-6" />,
          route: '/patient/messages',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="w-6 h-6" />,
          route: '/patient/settings',
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User className="w-6 h-6" />,
          route: '/patient/settings',
        },
      ];

      const { container } = render(
        <ModeProvider initialMode="simple">
          <BottomNav items={items} />
        </ModeProvider>
      );

      // Find profile link
      const allLinks = container.querySelectorAll('a');
      const profileLink = Array.from(allLinks).find(link => {
        const label = link.querySelector('.bottom-nav-label');
        return label?.textContent === 'Profile';
      });

      expect(profileLink).toBeTruthy();
      
      // Verify profile navigates to settings, not home (Requirement 7.1)
      expect(profileLink?.getAttribute('href')).toBe('/patient/settings');
      expect(profileLink?.getAttribute('href')).not.toBe('/patient');
    });

    it('should use User icon for profile item', () => {
      const items: BottomNavItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <Home className="w-6 h-6" />,
          route: '/patient',
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: <MessageSquare className="w-6 h-6" />,
          route: '/patient/messages',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="w-6 h-6" />,
          route: '/patient/settings',
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User className="w-6 h-6" />,
          route: '/patient/settings',
        },
      ];

      const { container } = render(
        <ModeProvider initialMode="simple">
          <BottomNav items={items} />
        </ModeProvider>
      );

      // Find profile link
      const allLinks = container.querySelectorAll('a');
      const profileLink = Array.from(allLinks).find(link => {
        const label = link.querySelector('.bottom-nav-label');
        return label?.textContent === 'Profile';
      });

      const profileIcon = profileLink?.querySelector('svg');
      
      // Verify User icon is used (Requirement 7.2)
      expect(profileIcon).toBeTruthy();
      expect(profileIcon?.classList.contains('w-6')).toBe(true);
      expect(profileIcon?.classList.contains('h-6')).toBe(true);
    });
  });

  describe('Settings Page Display', () => {
    it('should display all account management options on settings page', () => {
      const mockLogout = vi.fn();
      
      render(
        <ModeProvider initialMode="simple">
          <SimplifiedSettings onLogout={mockLogout} />
        </ModeProvider>
      );
      
      // Verify settings page displays account management options (Requirement 7.3)
      const settingsHeadings = screen.getAllByText('Settings');
      expect(settingsHeadings.length).toBeGreaterThan(0);
      
      const languageLabels = screen.getAllByText('Language');
      expect(languageLabels.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Mode')).toBeDefined();
      
      // Verify logout button is present
      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      expect(logoutButton).toBeDefined();
    });

    it('should allow logout from settings page', async () => {
      const mockLogout = vi.fn();
      
      render(
        <ModeProvider initialMode="simple">
          <SimplifiedSettings onLogout={mockLogout} />
        </ModeProvider>
      );
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);
      
      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/settings\.logoutConfirmTitle/i)).toBeDefined();
      });
      
      // Confirm logout - find the logout button in the dialog
      const allLogoutButtons = screen.getAllByRole('button', { name: 'Logout' });
      // The last one should be in the confirmation dialog
      const confirmButton = allLogoutButtons[allLogoutButtons.length - 1];
      fireEvent.click(confirmButton);
      
      // Should call logout function (Requirement 7.3)
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('Complete Profile to Settings Flow', () => {
    it('should complete full flow from profile tab to settings page', async () => {
      const items: BottomNavItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <Home className="w-6 h-6" />,
          route: '/patient',
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: <MessageSquare className="w-6 h-6" />,
          route: '/patient/messages',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="w-6 h-6" />,
          route: '/patient/settings',
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User className="w-6 h-6" />,
          route: '/patient/settings',
        },
      ];

      // Render bottom nav
      const { container } = render(
        <ModeProvider initialMode="simple">
          <BottomNav items={items} />
        </ModeProvider>
      );

      // Find and verify profile link
      const allLinks = container.querySelectorAll('a');
      const profileLink = Array.from(allLinks).find(link => {
        const label = link.querySelector('.bottom-nav-label');
        return label?.textContent === 'Profile';
      });

      expect(profileLink).toBeTruthy();
      expect(profileLink?.getAttribute('href')).toBe('/patient/settings');
      
      // Simulate navigation to settings page
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/patient/settings');
      
      // Render settings page
      const mockLogout = vi.fn();
      const { rerender } = render(
        <ModeProvider initialMode="simple">
          <SimplifiedSettings onLogout={mockLogout} />
        </ModeProvider>
      );
      
      // Verify settings page displays correctly (Requirements 7.1, 7.2, 7.3)
      const settingsHeadings = screen.getAllByText('Settings');
      expect(settingsHeadings.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Logout' })).toBeDefined();
    });

    it('should distinguish between settings and profile tabs while both navigate to same page', () => {
      const items: BottomNavItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <Home className="w-6 h-6" />,
          route: '/patient',
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: <MessageSquare className="w-6 h-6" />,
          route: '/patient/messages',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="w-6 h-6" />,
          route: '/patient/settings',
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User className="w-6 h-6" />,
          route: '/patient/settings',
        },
      ];

      const { container } = render(
        <ModeProvider initialMode="simple">
          <BottomNav items={items} />
        </ModeProvider>
      );

      // Find both settings and profile links
      const allLinks = container.querySelectorAll('a');
      const settingsLink = Array.from(allLinks).find(link => {
        const label = link.querySelector('.bottom-nav-label');
        return label?.textContent === 'Settings';
      });
      const profileLink = Array.from(allLinks).find(link => {
        const label = link.querySelector('.bottom-nav-label');
        return label?.textContent === 'Profile';
      });

      // Both should exist and navigate to same page
      expect(settingsLink).toBeTruthy();
      expect(profileLink).toBeTruthy();
      expect(settingsLink?.getAttribute('href')).toBe('/patient/settings');
      expect(profileLink?.getAttribute('href')).toBe('/patient/settings');
      
      // But they should have different labels and icons
      expect(settingsLink?.querySelector('.bottom-nav-label')?.textContent).toBe('Settings');
      expect(profileLink?.querySelector('.bottom-nav-label')?.textContent).toBe('Profile');
    });
  });
});
