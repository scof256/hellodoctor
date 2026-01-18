'use client';

import { Tutorial } from './Tutorial';
import { useTutorial } from '../hooks/useTutorial';
import { getTutorialSteps } from '../lib/tutorial-content';

/**
 * Wrapper component that manages tutorial state and display
 * Shows tutorial on first visit and provides methods to show again
 */
export function TutorialWrapper() {
  const { isOpen, isLoading, completeTutorial, skipTutorial } = useTutorial();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  const steps = getTutorialSteps();

  return (
    <Tutorial
      steps={steps}
      onComplete={completeTutorial}
      onSkip={skipTutorial}
      isOpen={isOpen}
    />
  );
}

/**
 * Hook to access tutorial controls from anywhere in the app
 * Use this in settings or help sections to allow users to show tutorial again
 */
export { useTutorial };
