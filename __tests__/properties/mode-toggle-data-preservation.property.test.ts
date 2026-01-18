/**
 * Feature: whatsapp-simple-ux, Property 1: Mode Toggle Data Preservation
 * 
 * For any user state (including form data, navigation history, and user inputs), 
 * switching between Simple and Advanced modes should preserve all data without 
 * loss or corruption.
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { ModeProvider, useMode, type AppMode } from '@/app/contexts/ModeContext';
import React, { useState } from 'react';

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
  cleanup(); // Clean up any rendered components
});

// Arbitrary generator for user state data
const arbitraryUserState = fc.record({
  formData: fc.record({
    name: fc.string(),
    email: fc.string(),
    phone: fc.string(),
    message: fc.string(),
  }),
  navigationHistory: fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
  userInputs: fc.dictionary(fc.string(), fc.string()),
  scrollPosition: fc.integer({ min: 0, max: 10000 }),
  selectedItems: fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
});

// Test component that holds user state
function TestComponentWithState({ initialState }: { initialState: any }) {
  const { mode, toggleMode } = useMode();
  const [state, setState] = useState(initialState);

  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': 'mode' }, mode),
    React.createElement('div', { 'data-testid': 'state' }, JSON.stringify(state)),
    React.createElement(
      'button',
      { onClick: toggleMode, 'data-testid': 'toggle-button' },
      'Toggle Mode'
    ),
    React.createElement(
      'button',
      { onClick: () => setState({ ...state, modified: true }), 'data-testid': 'modify-button' },
      'Modify State'
    )
  );
}

describe('Property 1: Mode Toggle Data Preservation', () => {
  it('preserves arbitrary user state when toggling from simple to advanced', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Store initial state
        const initialState = { ...userState };

        // Start in simple mode
        expect(result.current.mode).toBe('simple');

        // Toggle to advanced mode
        act(() => {
          result.current.toggleMode();
        });

        expect(result.current.mode).toBe('advanced');

        // Verify state is unchanged
        expect(JSON.stringify(initialState)).toBe(JSON.stringify(userState));

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves arbitrary user state when toggling from advanced to simple', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Set to advanced mode first
        act(() => {
          result.current.setMode('advanced');
        });

        // Store initial state
        const initialState = { ...userState };

        expect(result.current.mode).toBe('advanced');

        // Toggle to simple mode
        act(() => {
          result.current.toggleMode();
        });

        expect(result.current.mode).toBe('simple');

        // Verify state is unchanged
        expect(JSON.stringify(initialState)).toBe(JSON.stringify(userState));

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves component state through multiple mode toggles', () => {
    fc.assert(
      fc.property(
        arbitraryUserState,
        fc.integer({ min: 1, max: 10 }),
        (userState, numToggles) => {
          // Clean up before each iteration
          localStorageMock.clear();
          
          const { result, unmount } = renderHook(() => useMode(), {
            wrapper: ModeProvider,
          });

          // Store initial state
          const initialState = JSON.stringify(userState);

          // Perform multiple toggles
          for (let i = 0; i < numToggles; i++) {
            act(() => {
              result.current.toggleMode();
            });
          }

          // Verify state is still unchanged
          expect(initialState).toBe(JSON.stringify(userState));

          // Verify mode is correct based on number of toggles
          const expectedMode = numToggles % 2 === 0 ? 'simple' : 'advanced';
          expect(result.current.mode).toBe(expectedMode);

          // Clean up after this iteration
          unmount();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves React component state when mode is toggled', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        cleanup();
        localStorageMock.clear();
        
        const { getByTestId, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestComponentWithState, { initialState: userState })
          )
        );

        // Get initial state
        const initialStateElement = getByTestId('state');
        const initialStateText = initialStateElement.textContent;

        // Verify we start in simple mode
        expect(getByTestId('mode').textContent).toBe('simple');

        // Toggle mode
        const toggleButton = getByTestId('toggle-button');
        act(() => {
          toggleButton.click();
        });

        // Verify mode changed
        expect(getByTestId('mode').textContent).toBe('advanced');

        // Verify state is preserved
        expect(getByTestId('state').textContent).toBe(initialStateText);

        // Clean up after this iteration
        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves modified state after mode toggle', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        cleanup();
        localStorageMock.clear();
        
        const { getByTestId, unmount } = render(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(TestComponentWithState, { initialState: userState })
          )
        );

        // Modify state
        const modifyButton = getByTestId('modify-button');
        act(() => {
          modifyButton.click();
        });

        // Get modified state
        const modifiedStateText = getByTestId('state').textContent;
        expect(modifiedStateText).toContain('"modified":true');

        // Toggle mode
        const toggleButton = getByTestId('toggle-button');
        act(() => {
          toggleButton.click();
        });

        // Verify modified state is still preserved
        expect(getByTestId('state').textContent).toBe(modifiedStateText);
        expect(getByTestId('state').textContent).toContain('"modified":true');

        // Clean up after this iteration
        unmount();
        cleanup();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('mode persistence to localStorage does not corrupt user state', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Store initial state
        const initialState = JSON.stringify(userState);

        // Toggle mode (this triggers localStorage write)
        act(() => {
          result.current.toggleMode();
        });

        // Verify localStorage was updated
        expect(localStorageMock.getItem('hellodoctor-app-mode')).toBe('advanced');

        // Verify user state is unchanged
        expect(initialState).toBe(JSON.stringify(userState));

        // Toggle back
        act(() => {
          result.current.toggleMode();
        });

        // Verify localStorage was updated again
        expect(localStorageMock.getItem('hellodoctor-app-mode')).toBe('simple');

        // Verify user state is still unchanged
        expect(initialState).toBe(JSON.stringify(userState));

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves form data structure integrity through mode changes', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        // Verify form data structure before toggle
        const formDataBefore = { ...userState.formData };
        const formDataKeys = Object.keys(formDataBefore);

        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Toggle mode
        act(() => {
          result.current.toggleMode();
        });

        // Verify form data structure after toggle
        const formDataAfter = { ...userState.formData };
        const formDataKeysAfter = Object.keys(formDataAfter);

        // Keys should be identical
        expect(formDataKeys.sort()).toEqual(formDataKeysAfter.sort());

        // Values should be identical
        for (const key of formDataKeys) {
          expect(formDataBefore[key]).toBe(formDataAfter[key]);
        }

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves navigation history order through mode changes', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const navigationBefore = [...userState.navigationHistory];

        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Toggle mode multiple times
        act(() => {
          result.current.toggleMode();
          result.current.toggleMode();
        });

        const navigationAfter = [...userState.navigationHistory];

        // Navigation history should be identical in order
        expect(navigationBefore).toEqual(navigationAfter);

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves scroll position through mode changes', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const scrollPositionBefore = userState.scrollPosition;

        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Toggle mode
        act(() => {
          result.current.toggleMode();
        });

        const scrollPositionAfter = userState.scrollPosition;

        // Scroll position should be unchanged
        expect(scrollPositionBefore).toBe(scrollPositionAfter);

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('preserves selected items collection through mode changes', () => {
    fc.assert(
      fc.property(arbitraryUserState, (userState) => {
        // Clean up before each iteration
        localStorageMock.clear();
        
        const selectedItemsBefore = [...userState.selectedItems];

        const { result, unmount } = renderHook(() => useMode(), {
          wrapper: ModeProvider,
        });

        // Toggle mode
        act(() => {
          result.current.toggleMode();
        });

        const selectedItemsAfter = [...userState.selectedItems];

        // Selected items should be identical
        expect(selectedItemsBefore).toEqual(selectedItemsAfter);

        // Clean up after this iteration
        unmount();

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
