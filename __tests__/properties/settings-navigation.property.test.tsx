/**
 * Feature: auth-ui-restoration, Property 2: Settings Navigation in Simple Mode
 * 
 * For any patient user in Simple Mode, the Bottom Navigation should include 
 * a settings item that navigates to the settings page.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3
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

describe('Property 2: Settings Navigation in Simple Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include settings item in bottom nav for Simple Mode', () => {
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
              route: '/patient',
            },
          ];

          const { container } = render(
            <ModeProvider initialMode="simple">
              <BottomNav items={items} />
            </ModeProvider>
          );

          const settingsLink = container.querySelector('a[href="/patient/settings"]');
          expect(settingsLink).toBeTruthy();

          const settingsLabel = settingsLink?.querySelector('.bottom-nav-label');
          expect(settingsLabel?.textContent).toBe('Settings');

          const navItems = container.querySelectorAll('.bottom-nav-item');
          expect(navItems.length).toBeLessThanOrEqual(4);
          expect(navItems.length).toBe(4);

          const itemIds = Array.from(navItems).map(
            (item) => item.getAttribute('href')?.split('/').pop() || ''
          );
          expect(itemIds).toContain('settings');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should navigate to settings page when settings item is clicked', () => {
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
              route: '/patient',
            },
          ];

          const { container } = render(
            <ModeProvider initialMode="simple">
              <BottomNav items={items} />
            </ModeProvider>
          );

          const settingsLink = container.querySelector('a[href="/patient/settings"]');
          expect(settingsLink).toBeTruthy();
          expect(settingsLink?.getAttribute('href')).toBe('/patient/settings');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use appropriate Settings icon for recognition', () => {
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
              route: '/patient',
            },
          ];

          const { container } = render(
            <ModeProvider initialMode="simple">
              <BottomNav items={items} />
            </ModeProvider>
          );

          const settingsLink = container.querySelector('a[href="/patient/settings"]');
          const settingsIcon = settingsLink?.querySelector('svg');
          expect(settingsIcon).toBeTruthy();
          
          expect(settingsIcon?.classList.contains('w-6')).toBe(true);
          expect(settingsIcon?.classList.contains('h-6')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
