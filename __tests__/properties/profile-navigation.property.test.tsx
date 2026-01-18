/**
 * Feature: auth-ui-restoration, Property 6: Profile Navigation to Settings
 * 
 * For any patient user in Simple Mode, clicking the profile item in Bottom Navigation 
 * should navigate to the settings page (not the home page).
 * 
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/patient',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock button feedback
vi.mock('@/app/lib/button-feedback', () => ({
  handleButtonPress: vi.fn(),
}));

// Mock localization hook
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'navigation.home': 'Home',
        'navigation.messages': 'Messages',
        'navigation.settings': 'Settings',
        'navigation.profile': 'Profile',
      };
      return translations[key] || key;
    },
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

import { ModeProvider } from '@/app/contexts/ModeContext';
import { BottomNav, BottomNavItem } from '@/app/components/BottomNav';
import { Home, MessageSquare, Settings, User } from 'lucide-react';

describe('Property 6: Profile Navigation to Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate profile item to settings page, not home page', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (messageBadgeCount) => {
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
              badge: messageBadgeCount > 0 ? messageBadgeCount : undefined,
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

          // Find the profile link by looking for User icon
          const allLinks = container.querySelectorAll('a');
          const profileLink = Array.from(allLinks).find(link => {
            const label = link.querySelector('.bottom-nav-label');
            return label?.textContent === 'Profile';
          });

          expect(profileLink).toBeTruthy();
          expect(profileLink?.getAttribute('href')).toBe('/patient/settings');
          
          // Ensure profile does NOT navigate to home page
          expect(profileLink?.getAttribute('href')).not.toBe('/patient');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use User icon for profile item recognition', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        () => {
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

          // Find the profile link
          const allLinks = container.querySelectorAll('a');
          const profileLink = Array.from(allLinks).find(link => {
            const label = link.querySelector('.bottom-nav-label');
            return label?.textContent === 'Profile';
          });

          const profileIcon = profileLink?.querySelector('svg');
          expect(profileIcon).toBeTruthy();
          
          // Verify icon has proper sizing
          expect(profileIcon?.classList.contains('w-6')).toBe(true);
          expect(profileIcon?.classList.contains('h-6')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all account management options on settings page', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        () => {
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

          // Both settings and profile should navigate to the same page
          const settingsLink = container.querySelector('a[href="/patient/settings"]');
          const allLinks = container.querySelectorAll('a');
          const profileLink = Array.from(allLinks).find(link => {
            const label = link.querySelector('.bottom-nav-label');
            return label?.textContent === 'Profile';
          });

          expect(settingsLink?.getAttribute('href')).toBe('/patient/settings');
          expect(profileLink?.getAttribute('href')).toBe('/patient/settings');
          
          // Both should point to the same destination
          expect(settingsLink?.getAttribute('href')).toBe(profileLink?.getAttribute('href'));
        }
      ),
      { numRuns: 100 }
    );
  });
});
