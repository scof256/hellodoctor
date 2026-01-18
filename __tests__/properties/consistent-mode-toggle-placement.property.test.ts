/**
 * Feature: whatsapp-simple-ux, Property 3: Consistent Mode Toggle Placement
 * 
 * For any screen in the application, the mode toggle button should exist in the 
 * same position (top-right corner) with the same styling.
 * 
 * Validates: Requirements 1.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { ModeProvider } from '@/app/contexts/ModeContext';
import { ModeToggle } from '@/app/components/ModeToggle';
import React from 'react';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  localStorageMock.clear();
});

afterEach(() => {
  localStorageMock.clear();
  cleanup();
});

// Arbitrary generator for screen contexts
const arbitraryScreenContext = fc.record({
  screenName: fc.constantFrom(
    'home',
    'intake',
    'messages',
    'appointments',
    'settings',
    'profile',
    'booking',
    'doctor-dashboard',
    'patient-list',
    'analytics'
  ),
  hasContent: fc.boolean(),
  contentHeight: fc.integer({ min: 100, max: 5000 }),
  hasNavigation: fc.boolean(),
});

// Test component that simulates different screens
function TestScreen({ context }: { context: any }) {
  return React.createElement(
    'div',
    {
      'data-testid': 'screen',
      'data-screen-name': context.screenName,
      style: {
        height: context.hasContent ? `${context.contentHeight}px` : 'auto',
        position: 'relative',
      },
    },
    context.hasNavigation &&
      React.createElement('nav', { 'data-testid': 'navigation' }, 'Navigation'),
    React.createElement(ModeToggle, { position: 'header' }),
    context.hasContent &&
      React.createElement('div', { 'data-testid': 'content' }, 'Screen Content')
  );
}

describe('Property 3: Consistent Mode Toggle Placement', () => {
  it('mode toggle appears in top-right corner for any screen', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        // Find the mode toggle
        const modeToggle = container.querySelector('.mode-toggle.header');
        expect(modeToggle).toBeTruthy();

        // Verify position is fixed (for header position)
        const computedStyle = window.getComputedStyle(modeToggle as Element);
        expect(computedStyle.position).toBe('fixed');

        // Verify top-right positioning
        expect(computedStyle.top).toBe('16px');
        expect(computedStyle.right).toBe('16px');

        // Verify z-index for proper layering
        expect(computedStyle.zIndex).toBe('1000');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle button has consistent styling across all screens', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        // Find the mode toggle button
        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        const computedStyle = window.getComputedStyle(button as Element);

        // Verify consistent styling properties
        expect(computedStyle.display).toBe('flex');
        expect(computedStyle.alignItems).toBe('center');
        expect(computedStyle.backgroundColor).toBe('rgb(255, 255, 255)'); // #FFFFFF
        expect(computedStyle.borderRadius).toBe('24px');
        expect(computedStyle.fontSize).toBe('16px');
        expect(computedStyle.fontWeight).toBe('600');
        expect(computedStyle.cursor).toBe('pointer');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle maintains position regardless of screen content height', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }),
        fc.constantFrom('home', 'intake', 'messages', 'settings'),
        (contentHeight, screenName) => {
          cleanup();
          localStorageMock.clear();

          const context = {
            screenName,
            hasContent: true,
            contentHeight,
            hasNavigation: true,
          };

          const { container, unmount } = render(
            React.createElement(
              ModeProvider,
              null,
              React.createElement(TestScreen, { context })
            )
          );

          const modeToggle = container.querySelector('.mode-toggle.header');
          expect(modeToggle).toBeTruthy();

          const computedStyle = window.getComputedStyle(modeToggle as Element);

          // Position should always be fixed at top-right
          expect(computedStyle.position).toBe('fixed');
          expect(computedStyle.top).toBe('16px');
          expect(computedStyle.right).toBe('16px');

          unmount();
          cleanup();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mode toggle maintains position with or without navigation', () => {
    fc.assert(
      fc.property(
        arbitraryScreenContext,
        fc.boolean(),
        (screenContext, hasNavigation) => {
          cleanup();
          localStorageMock.clear();

          const context = { ...screenContext, hasNavigation };

          const { container, unmount } = render(
            React.createElement(
              ModeProvider,
              null,
              React.createElement(TestScreen, { context })
            )
          );

          const modeToggle = container.querySelector('.mode-toggle.header');
          expect(modeToggle).toBeTruthy();

          const computedStyle = window.getComputedStyle(modeToggle as Element);

          // Position should be consistent regardless of navigation presence
          expect(computedStyle.position).toBe('fixed');
          expect(computedStyle.top).toBe('16px');
          expect(computedStyle.right).toBe('16px');
          expect(computedStyle.zIndex).toBe('1000');

          unmount();
          cleanup();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mode toggle icon and label are always present', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        // Verify icon is present
        const icon = container.querySelector('.mode-icon');
        expect(icon).toBeTruthy();
        expect(icon?.textContent).toMatch(/[🎯⚙️]/);

        // Verify label is present
        const label = container.querySelector('.mode-label');
        expect(label).toBeTruthy();
        expect(label?.textContent).toMatch(/^(Simple|Advanced)$/);

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle has consistent gap between icon and label', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        const computedStyle = window.getComputedStyle(button as Element);

        // Verify gap between icon and label
        expect(computedStyle.gap).toBe('8px');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle maintains box shadow styling across screens', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        const computedStyle = window.getComputedStyle(button as Element);

        // Verify box shadow is present
        expect(computedStyle.boxShadow).toBeTruthy();
        expect(computedStyle.boxShadow).not.toBe('none');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle button has accessible aria-label', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        // Verify aria-label exists and is descriptive
        const ariaLabel = button?.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toMatch(/Switch to (simple|advanced) mode/);

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle position is consistent when rendered in settings', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(
              'div',
              { 'data-testid': 'settings-screen' },
              React.createElement(ModeToggle, { position: 'settings' })
            )
          )
        );

        const modeToggle = container.querySelector('.mode-toggle.settings');
        expect(modeToggle).toBeTruthy();

        const computedStyle = window.getComputedStyle(modeToggle as Element);

        // In settings, position should be relative
        expect(computedStyle.position).toBe('relative');

        // Button styling should still be consistent
        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        const buttonStyle = window.getComputedStyle(button as Element);
        expect(buttonStyle.borderRadius).toBe('24px');
        expect(buttonStyle.fontSize).toBe('16px');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode toggle maintains consistent padding across all screens', () => {
    fc.assert(
      fc.property(arbitraryScreenContext, (screenContext) => {
        cleanup();
        localStorageMock.clear();

        const { container, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestScreen, { context: screenContext })
          )
        );

        const button = container.querySelector('.mode-toggle-button');
        expect(button).toBeTruthy();

        const computedStyle = window.getComputedStyle(button as Element);

        // Verify consistent padding
        expect(computedStyle.padding).toBe('12px 20px');

        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
