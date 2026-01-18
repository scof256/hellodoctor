'use client';

import { useTutorial } from '../hooks/useTutorial';
import { BookOpen } from 'lucide-react';

/**
 * Component to display tutorial-related settings
 * Can be integrated into a settings page or menu
 */
export function TutorialSettings() {
  const { showTutorialAgain, getTutorialState } = useTutorial();

  const tutorialState = getTutorialState();
  const hasCompletedTutorial = tutorialState?.completed || tutorialState?.skipped;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#25D366]/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-[#25D366]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Tutorial</h3>
            <p className="text-sm text-gray-600">
              {hasCompletedTutorial
                ? 'Learn how to use the app'
                : 'Not completed yet'}
            </p>
          </div>
        </div>
        <button
          onClick={showTutorialAgain}
          className="px-4 py-2 bg-[#25D366] text-white font-medium rounded-lg hover:bg-[#20BA5A] transition-colors"
        >
          {hasCompletedTutorial ? 'Show Again' : 'Start'}
        </button>
      </div>
    </div>
  );
}
