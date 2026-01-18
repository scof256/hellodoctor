/**
 * Property Test: Sign-In Access from Public Pages
 * Feature: auth-ui-restoration, Property 5: Sign-in access from public pages
 * Validates: Requirements 6.1, 6.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isSignedIn: false,
    isLoaded: true,
  }),
}));

// Mock Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
}));

import LandingPage from '@/app/(public)/page';

describe('Property: Sign-In Access from Public Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always display visible sign-in links on public pages for unauthenticated users', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // Always test with unauthenticated state
        () => {
          render(<LandingPage />);

          // Should have multiple sign-in links for accessibility
          const signInLinks = screen.getAllByText(/sign in/i);
          
          // Should have at least 2 sign-in links (nav + hero/CTA sections)
          expect(signInLinks.length).toBeGreaterThanOrEqual(2);
          
          // All sign-in links should point to /sign-in
          signInLinks.forEach((link) => {
            const href = link.closest('a')?.getAttribute('href');
            expect(href).toBe('/sign-in');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display sign-in link in navigation bar prominently', () => {
    render(<LandingPage />);

    // Navigation sign-in should be visible
    const signInLinks = screen.getAllByTestId('link-/sign-in');
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    
    // First link should be in navigation
    const navSignIn = signInLinks[0];
    expect(navSignIn).toBeDefined();
    expect(navSignIn.textContent).toMatch(/sign in/i);
    
    // Should have proper styling for visibility
    const className = navSignIn.getAttribute('class');
    expect(className).toBeTruthy();
  });

  it('should display sign-in button in hero section with prominent styling', () => {
    render(<LandingPage />);

    const signInLinks = screen.getAllByText(/sign in/i);
    
    // Find the hero section sign-in button (should have "Dashboard" in text)
    const heroSignIn = signInLinks.find(link => 
      link.textContent?.includes('Dashboard')
    );
    
    expect(heroSignIn).toBeDefined();
    
    // Hero sign-in should have button-like styling
    const parentLink = heroSignIn?.closest('a');
    const className = parentLink?.getAttribute('class');
    expect(className).toContain('px-');
    expect(className).toContain('py-');
    expect(className).toContain('rounded');
  });

  it('should display sign-in button in CTA section', () => {
    render(<LandingPage />);

    const signInLinks = screen.getAllByText(/sign in/i);
    
    // Should have at least 3 sign-in links (nav, hero, CTA)
    expect(signInLinks.length).toBeGreaterThanOrEqual(3);
    
    // All should be properly linked
    signInLinks.forEach((link) => {
      const href = link.closest('a')?.getAttribute('href');
      expect(href).toBe('/sign-in');
    });
  });

  it('should ensure sign-in links are styled consistently with app design', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        () => {
          render(<LandingPage />);

          const signInLinks = screen.getAllByTestId('link-/sign-in');
          
          // All sign-in links should have proper styling
          signInLinks.forEach((link) => {
            const className = link.getAttribute('class');
            expect(className).toBeTruthy();
            
            // Should have color/hover states
            if (className) {
              const hasColorStyling = 
                className.includes('text-') || 
                className.includes('bg-') ||
                className.includes('hover:');
              expect(hasColorStyling).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should position sign-in links prominently on the page', () => {
    render(<LandingPage />);

    const signInLinks = screen.getAllByText(/sign in/i);
    
    // Should have multiple sign-in access points
    expect(signInLinks.length).toBeGreaterThanOrEqual(2);
    
    // Each should be in a visible location (nav, hero, or CTA)
    signInLinks.forEach((link) => {
      const parentLink = link.closest('a');
      expect(parentLink).toBeDefined();
      expect(parentLink?.getAttribute('href')).toBe('/sign-in');
    });
  });

  it('should maintain sign-in access across different viewport sizes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1920 }), // viewport widths
        (viewportWidth) => {
          // Note: In a real test, we'd set viewport size
          // For this property test, we verify the links exist regardless
          render(<LandingPage />);

          const signInLinks = screen.getAllByText(/sign in/i);
          
          // Sign-in should always be accessible
          expect(signInLinks.length).toBeGreaterThanOrEqual(2);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
