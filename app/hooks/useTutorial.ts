'use client';

import { useState, useEffect } from 'react';

const TUTORIAL_STORAGE_KEY = 'hellodoctor_tutorial_completed';

export interface TutorialState {
  completed: boolean;
  skipped: boolean;
  completedAt?: Date;
}

/**
 * Hook to manage tutorial state
 * - Shows tutorial on first visit
 * - Stores completion in localStorage
 * - Provides methods to show tutorial again
 */
export function useTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load tutorial state from localStorage on mount
  useEffect(() => {
    const loadTutorialState = () => {
      try {
        const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (stored) {
          const state: TutorialState = JSON.parse(stored);
          // Don't show tutorial if it was completed or skipped
          setIsOpen(false);
        } else {
          // First visit - show tutorial
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error loading tutorial state:', error);
        // On error, show tutorial to be safe
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadTutorialState();
  }, []);

  const completeTutorial = () => {
    const state: TutorialState = {
      completed: true,
      skipped: false,
      completedAt: new Date(),
    };
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving tutorial completion:', error);
    }
  };

  const skipTutorial = () => {
    const state: TutorialState = {
      completed: false,
      skipped: true,
      completedAt: new Date(),
    };
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving tutorial skip:', error);
    }
  };

  const showTutorialAgain = () => {
    setIsOpen(true);
  };

  const resetTutorial = () => {
    try {
      localStorage.removeItem(TUTORIAL_STORAGE_KEY);
      setIsOpen(true);
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    }
  };

  const getTutorialState = (): TutorialState | null => {
    try {
      const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error getting tutorial state:', error);
      return null;
    }
  };

  return {
    isOpen,
    isLoading,
    completeTutorial,
    skipTutorial,
    showTutorialAgain,
    resetTutorial,
    getTutorialState,
  };
}
