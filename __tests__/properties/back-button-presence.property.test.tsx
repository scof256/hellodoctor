/**
 * Property-Based Test: Back Button Presence
 * 
 * Feature: whatsapp-simple-ux
 * Property 10: Back Button Presence
 * 
 * Validates: Requirements 3.3
 * 
 * Property: For any screen except the home screen, a back button with arrow icon 
 * should be present and functional.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { BackButton, useShowBackButton } from '@/app/components/BackButton';
import React from 'react';

// Mock next/navigation
const mockBack = vi.fn();
const mockPathname = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname(),
}));

// Mock localization
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock button feedback
vi.mock('@/app/lib/button-feedback', () => ({
  handleButtonPress: vi.fn(),
}));

// Test component that uses the hook
function TestComponent({ pathname }: { pathname: string }) {
  mockPathname.mockReturnValue(pathname);
  const showBackButton = useShowBackButton();
  
  return (
    <div>
      {showBackButton && <BackButton />}
      <div data-testid="show-back-button">{showBackButton.toString()}</div>
    </div>
  );
}

describe('Property 10: Back Button Presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any rendered components
    document.body.innerHTML = '';
  });

  it('should render back button with arrow icon', () => {
    mockPathname.mockReturnValue('/patient/appointments');
    
    render(<BackButton />);
    
    const button = screen.getByTestId('back-button');
    expect(button).toBeInTheDocument();
    
    // Check for arrow icon (lucide-react renders as svg)
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should call router.back() when clicked', () => {
    mockPathname.mockReturnValue('/patient/appointments');
    
    render(<BackButton />);
    
    const button = screen.getByTestId('back-button');
    button.click();
    
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('should support custom onClick handler', () => {
    const customHandler = vi.fn();
    mockPathname.mockReturnValue('/patient/appointments');
    
    render(<BackButton onClick={customHandler} />);
    
    const button = screen.getByTestId('back-button');
    button.click();
    
    expect(customHandler).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  /**
   * Property: For any non-home screen path, the back button should be shown
   */
  it('property: back button should be present on all non-home screens', () => {
    fc.assert(
      fc.property(
        // Generate various non-home screen paths
        fc.oneof(
          fc.constantFrom(
            '/patient/appointments',
            '/patient/messages',
            '/patient/intake',
            '/patient/sessions',
            '/patient/settings',
            '/doctor/appointments',
            '/doctor/patients',
            '/doctor/messages',
            '/doctor/availability',
            '/admin/users',
            '/admin/doctors',
            '/support',
            '/meeting/123'
          ),
          fc.string({ minLength: 2, maxLength: 50 }).map(s => `/${s}`),
          fc.tuple(
            fc.constantFrom('patient', 'doctor', 'admin'),
            fc.string({ minLength: 1, maxLength: 20 })
          ).map(([role, path]) => `/${role}/${path}`)
        ),
        (pathname) => {
          // Skip home screens
          const homeScreens = ['/patient', '/doctor', '/admin', '/'];
          if (homeScreens.includes(pathname)) {
            return true;
          }

          mockPathname.mockReturnValue(pathname);
          
          const { container, unmount } = render(<TestComponent pathname={pathname} />);
          const showBackButton = screen.getByTestId('show-back-button').textContent;
          
          // Back button should be shown (showBackButton should be 'true')
          expect(showBackButton).toBe('true');
          
          // Back button should be rendered
          const button = container.querySelector('[data-testid="back-button"]');
          expect(button).toBeInTheDocument();
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any home screen path, the back button should NOT be shown
   */
  it('property: back button should NOT be present on home screens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient', '/doctor', '/admin', '/'),
        (pathname) => {
          mockPathname.mockReturnValue(pathname);
          
          const { container, unmount } = render(<TestComponent pathname={pathname} />);
          const showBackButton = screen.getByTestId('show-back-button').textContent;
          
          // Back button should NOT be shown (showBackButton should be 'false')
          expect(showBackButton).toBe('false');
          
          // Back button should NOT be rendered
          const button = container.querySelector('[data-testid="back-button"]');
          expect(button).not.toBeInTheDocument();
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Back button should always have minimum touch target size (48x48dp)
   */
  it('property: back button should meet minimum touch target size', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient/appointments', '/doctor/patients', '/admin/users'),
        (pathname) => {
          mockPathname.mockReturnValue(pathname);
          
          const { unmount } = render(<BackButton />);
          
          const button = screen.getByTestId('back-button');
          const styles = window.getComputedStyle(button);
          
          // Extract numeric values from minWidth and minHeight
          const minWidth = parseInt(styles.minWidth);
          const minHeight = parseInt(styles.minHeight);
          
          // Should meet minimum 48x48dp touch target (48px)
          expect(minWidth).toBeGreaterThanOrEqual(48);
          expect(minHeight).toBeGreaterThanOrEqual(48);
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Back button should always contain an arrow icon
   */
  it('property: back button should always contain arrow icon', () => {
    fc.assert(
      fc.property(
        fc.record({
          pathname: fc.constantFrom('/patient/appointments', '/doctor/patients', '/admin/users'),
          showLabel: fc.boolean(),
          disabled: fc.boolean(),
        }),
        ({ pathname, showLabel, disabled }) => {
          mockPathname.mockReturnValue(pathname);
          
          const { unmount } = render(<BackButton showLabel={showLabel} disabled={disabled} />);
          
          const button = screen.getByTestId('back-button');
          
          // Should contain an SVG (arrow icon from lucide-react)
          const svg = button.querySelector('svg');
          expect(svg).toBeInTheDocument();
          
          // Should have aria-label for accessibility
          expect(button).toHaveAttribute('aria-label');
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Disabled back button should not trigger navigation
   */
  it('property: disabled back button should not trigger navigation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/patient/appointments', '/doctor/patients'),
        (pathname) => {
          mockPathname.mockReturnValue(pathname);
          mockBack.mockClear();
          
          const { unmount } = render(<BackButton disabled={true} />);
          
          const button = screen.getByTestId('back-button');
          button.click();
          
          // Should not call router.back() when disabled
          expect(mockBack).not.toHaveBeenCalled();
          
          // Should have disabled attribute
          expect(button).toBeDisabled();
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Back button should be functional (clickable) on all non-home screens
   */
  it('property: back button should be functional on all non-home screens', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            '/patient/appointments',
            '/patient/messages',
            '/doctor/patients',
            '/admin/users'
          ),
          fc.tuple(
            fc.constantFrom('patient', 'doctor', 'admin'),
            fc.string({ minLength: 1, maxLength: 20 })
          ).map(([role, path]) => `/${role}/${path}`)
        ),
        (pathname) => {
          // Skip home screens
          const homeScreens = ['/patient', '/doctor', '/admin', '/'];
          if (homeScreens.includes(pathname)) {
            return true;
          }

          mockPathname.mockReturnValue(pathname);
          mockBack.mockClear();
          
          const { unmount } = render(<BackButton />);
          
          const button = screen.getByTestId('back-button');
          
          // Should not be disabled
          expect(button).not.toBeDisabled();
          
          // Should be clickable
          button.click();
          expect(mockBack).toHaveBeenCalledTimes(1);
          
          // Clean up this render
          unmount();
          cleanup();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
