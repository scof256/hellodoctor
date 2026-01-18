/**
 * Example: How to integrate the Tutorial System into your app
 * 
 * This file demonstrates the different ways to use the tutorial system:
 * 1. Automatic display on first visit (TutorialWrapper)
 * 2. Manual control in settings (TutorialSettings)
 * 3. Programmatic control (useTutorial hook)
 */

'use client';

import { TutorialWrapper } from './TutorialWrapper';
import { TutorialSettings } from './TutorialSettings';
import { useTutorial } from '../hooks/useTutorial';

/**
 * Example 1: Add to your main layout to show tutorial on first visit
 * 
 * In your app/layout.tsx or main layout component:
 */
export function LayoutWithTutorial({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TutorialWrapper />
    </>
  );
}

/**
 * Example 2: Add to settings page to allow users to replay tutorial
 * 
 * In your settings page:
 */
export function SettingsPageWithTutorial() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      {/* Other settings */}
      <div className="space-y-4">
        {/* Language, notifications, etc. */}
      </div>

      {/* Tutorial settings */}
      <TutorialSettings />
    </div>
  );
}

/**
 * Example 3: Programmatic control with useTutorial hook
 * 
 * Use this when you need custom control over the tutorial:
 */
export function CustomTutorialControl() {
  const { 
    showTutorialAgain, 
    resetTutorial, 
    getTutorialState 
  } = useTutorial();

  const tutorialState = getTutorialState();

  return (
    <div className="space-y-4">
      <div>
        <p>Tutorial Status:</p>
        <p className="text-sm text-gray-600">
          {tutorialState?.completed && 'Completed'}
          {tutorialState?.skipped && 'Skipped'}
          {!tutorialState && 'Not started'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={showTutorialAgain}
          className="px-4 py-2 bg-[#25D366] text-white rounded-lg"
        >
          Show Tutorial
        </button>

        <button
          onClick={resetTutorial}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
        >
          Reset Tutorial
        </button>
      </div>
    </div>
  );
}

/**
 * Example 4: Conditional tutorial display based on user role
 * 
 * Show tutorial only for patients, not doctors:
 */
export function RoleBasedTutorial({ userRole }: { userRole: 'patient' | 'doctor' }) {
  if (userRole !== 'patient') {
    return null;
  }

  return <TutorialWrapper />;
}

/**
 * Example 5: Tutorial with custom content
 * 
 * If you need different tutorial content for different contexts:
 */
export function CustomContentTutorial() {
  const { completeTutorial, skipTutorial } = useTutorial();
  
  const customSteps = [
    {
      id: 'custom-1',
      title: 'Custom Step 1',
      description: 'This is a custom tutorial step',
      illustration: '🎯',
    },
    // Add more custom steps...
  ];

  // You would need to import Tutorial component directly
  // and manage isOpen state yourself for custom content
  
  return null; // Implementation depends on your needs
}
