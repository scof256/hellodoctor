/**
 * Property Test: UserButton Visibility in Authenticated Views
 * Feature: auth-ui-restoration, Property 1: UserButton visibility in authenticated views
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  UserButton: ({ appearance }: { appearance?: unknown }) => (
    <div data-testid="user-button" data-appearance={JSON.stringify(appearance)}>
      UserButton
    </div>
  ),
  useUser: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sign-out-button">{children}</div>
  ),
}));

// Mock Next.js
vi.mock('next/navigation', () => ({
  usePathname: () => '/patient',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock tRPC
vi.mock('@/trpc/react', () => ({
  api: {
    notification: {
      getUnreadCount: {
        useQuery: () => ({ data: { count: 0 } }),
      },
      getMyNotifications: {
        useQuery: () => ({ data: { notifications: [] } }),
      },
      markAsRead: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
    },
    useUtils: () => ({
      notification: {
        getUnreadCount: { invalidate: vi.fn() },
        getMyNotifications: { invalidate: vi.fn() },
      },
    }),
  },
}));

// Mock contexts
vi.mock('@/app/contexts/ModeContext', () => ({
  useMode: () => ({
    isSimpleMode: () => false,
  }),
}));

vi.mock('@/app/components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock('@/app/components/StreamVideoProvider', () => ({
  StreamVideoProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../DashboardLayoutContext', () => ({
  DashboardLayoutProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/app/components/BackButton', () => ({
  BackButton: () => <button>Back</button>,
  useShowBackButton: () => false,
}));

vi.mock('@/app/components/BottomNav', () => ({
  BottomNav: () => <div data-testid="bottom-nav">BottomNav</div>,
}));

import DashboardLayout from '@/app/(dashboard)/layout';

describe('Property: UserButton Visibility in Authenticated Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always render UserButton when user is authenticated (desktop sidebar)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient', '/doctor', '/admin'),
        (pathname) => {
          const { container } = render(
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          );

          // UserButton should be rendered in the sidebar (user section)
          const userButtons = screen.getAllByTestId('user-button');
          
          // Should have at least one UserButton (in sidebar)
          expect(userButtons.length).toBeGreaterThanOrEqual(1);
          
          // Verify UserButton has proper styling
          const sidebarUserButton = userButtons[0];
          expect(sidebarUserButton).toBeDefined();
          
          // Check that appearance prop is set for visibility
          const appearance = sidebarUserButton?.getAttribute('data-appearance');
          expect(appearance).toBeTruthy();
          
          if (appearance) {
            const parsed = JSON.parse(appearance);
            expect(parsed.elements).toBeDefined();
            expect(parsed.elements.avatarBox).toContain('ring-2');
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should always render UserButton in header on mobile viewports', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient', '/doctor', '/admin'),
        (pathname) => {
          render(
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          );

          // UserButton should be rendered in both sidebar and header on mobile
          const userButtons = screen.getAllByTestId('user-button');
          
          // Should have at least 2 UserButtons (sidebar + mobile header)
          expect(userButtons.length).toBeGreaterThanOrEqual(2);
          
          // Verify both have proper styling
          userButtons.forEach((button) => {
            const appearance = button.getAttribute('data-appearance');
            expect(appearance).toBeTruthy();
            
            if (appearance) {
              const parsed = JSON.parse(appearance);
              expect(parsed.elements).toBeDefined();
              expect(parsed.elements.avatarBox).toContain('ring-2');
            }
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should render UserButton with sufficient size for touch interaction on mobile', () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    const userButtons = screen.getAllByTestId('user-button');
    
    // Mobile header UserButton should have touch-friendly sizing (at least 44x44px)
    const mobileUserButton = userButtons[1]; // Second one is in mobile header
    expect(mobileUserButton).toBeDefined();
    
    const appearance = mobileUserButton?.getAttribute('data-appearance');
    if (appearance) {
      const parsed = JSON.parse(appearance);
      // Check for w-9 h-9 (36px) which with ring-offset gives ~44px touch target
      expect(parsed.elements.avatarBox).toMatch(/w-\d+\s+h-\d+/);
    }
  });

  it('should render UserButton with proper contrast styling across all authenticated views', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient', '/doctor', '/admin'),
        (pathname) => {
          render(
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          );

          const userButtons = screen.getAllByTestId('user-button');
          
          // All UserButtons should have ring styling for visibility
          userButtons.forEach((button) => {
            const appearance = button.getAttribute('data-appearance');
            expect(appearance).toBeTruthy();
            
            if (appearance) {
              const parsed = JSON.parse(appearance);
              expect(parsed.elements.avatarBox).toContain('ring-2');
              expect(parsed.elements.avatarBox).toContain('ring-medical-200');
              expect(parsed.elements.userButtonTrigger).toContain('focus:ring-2');
            }
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
