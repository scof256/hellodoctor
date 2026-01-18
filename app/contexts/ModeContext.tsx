'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export type AppMode = 'simple' | 'advanced';

interface ModeContextValue {
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
  isSimpleMode: () => boolean;
  isAdvancedMode: () => boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const MODE_STORAGE_KEY = 'hellodoctor-app-mode';

export function ModeProvider({ children, initialMode }: { children: React.ReactNode; initialMode?: AppMode }) {
  // Initialize mode from initialMode prop (for testing), localStorage, or default to 'simple'
  const [mode, setModeState] = useState<AppMode>(() => {
    // If initialMode is provided (e.g., in tests), use it and skip localStorage
    if (initialMode) {
      return initialMode;
    }
    
    if (typeof window === 'undefined') {
      return 'simple'; // Default for SSR
    }
    
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'simple' || stored === 'advanced') {
        return stored;
      }
    } catch (error) {
      console.error('Failed to read mode from localStorage:', error);
    }
    
    return 'simple'; // Default mode
  });

  // Persist mode to localStorage whenever it changes (but not if initialMode is provided)
  useEffect(() => {
    // Skip localStorage persistence if initialMode is provided (e.g., in tests)
    if (initialMode) {
      return;
    }
    
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save mode to localStorage:', error);
    }
  }, [mode, initialMode]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prevMode) => (prevMode === 'simple' ? 'advanced' : 'simple'));
  }, []);

  const isSimpleMode = useCallback(() => {
    return mode === 'simple';
  }, [mode]);

  const isAdvancedMode = useCallback(() => {
    return mode === 'advanced';
  }, [mode]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      toggleMode,
      setMode,
      isSimpleMode,
      isAdvancedMode,
    }),
    [mode, toggleMode, setMode, isSimpleMode, isAdvancedMode]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error('useMode must be used within ModeProvider');
  }
  return ctx;
}
