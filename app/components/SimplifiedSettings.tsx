'use client';

import React, { useState } from 'react';
import { useMode } from '@/app/contexts/ModeContext';
import { useLocalization } from '@/app/hooks/useLocalization';
import { useTutorial } from '@/app/hooks/useTutorial';
import { useToast } from './Toast';
import { LanguageSelector } from './LanguageSelector';
import { ModeToggle } from './ModeToggle';

interface SimplifiedSettingsProps {
  onLogout?: () => void | Promise<void>;
}

/**
 * SimplifiedSettings Component
 * 
 * Provides a simplified settings interface for Simple Mode with:
 * - Maximum 6 options
 * - Toggle switches for on/off settings
 * - Immediate application of changes
 * - Logout with confirmation
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
export function SimplifiedSettings({ onLogout }: SimplifiedSettingsProps) {
  const { mode, isSimpleMode } = useMode();
  const { t, currentLanguage } = useLocalization();
  const { showTutorialAgain } = useTutorial();
  const { addToast } = useToast();
  
  // Local state for toggles (in real app, these would be persisted)
  const [notifications, setNotifications] = useState(true);
  const [voice, setVoice] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // In Simple Mode, show maximum 6 options
  const maxOptions = isSimpleMode() ? 6 : Infinity;

  const handleNotificationsToggle = () => {
    setNotifications(!notifications);
    // Immediate application - no save button needed
  };

  const handleVoiceToggle = () => {
    setVoice(!voice);
    // Immediate application - no save button needed
  };

  const handleShowTutorial = () => {
    showTutorialAgain();
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    if (!onLogout) {
      setShowLogoutConfirm(false);
      return;
    }

    setIsLoggingOut(true);
    
    try {
      // Call the logout function (may be async)
      await onLogout();
      setShowLogoutConfirm(false);
    } catch (error) {
      // Log error for debugging
      console.error('Logout failed:', error);
      
      // Display error toast to user
      addToast({
        type: 'error',
        title: t('settings.logoutError') || 'Logout Failed',
        message: t('settings.logoutErrorMessage') || 'Unable to logout. Please try again.',
        duration: 5000,
      });
      
      // Keep dialog open and session maintained
      setShowLogoutConfirm(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  // Settings options (limited to 6 in Simple Mode)
  const settingsOptions = [
    {
      id: 'language',
      label: t('settings.language') || 'Language',
      component: <LanguageSelector variant="buttons" />,
    },
    {
      id: 'mode',
      label: t('settings.mode') || 'Mode',
      component: <ModeToggle position="settings" />,
    },
    {
      id: 'notifications',
      label: t('settings.notifications') || 'Notifications',
      component: (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={handleNotificationsToggle}
            className="sr-only peer"
            aria-label="Toggle notifications"
          />
          <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-whatsapp-green/30 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-whatsapp-green"></div>
        </label>
      ),
    },
    {
      id: 'voice',
      label: t('settings.voice') || 'Voice',
      component: (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={voice}
            onChange={handleVoiceToggle}
            className="sr-only peer"
            aria-label="Toggle voice"
          />
          <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-whatsapp-green/30 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-whatsapp-green"></div>
        </label>
      ),
    },
    {
      id: 'tutorial',
      label: t('settings.tutorial') || 'Tutorial',
      component: (
        <button
          onClick={handleShowTutorial}
          className="px-4 py-2 text-whatsapp-green border border-whatsapp-green rounded-lg hover:bg-whatsapp-green/10 transition-colors"
        >
          {t('settings.showTutorial') || 'Show Tutorial'}
        </button>
      ),
    },
    {
      id: 'logout',
      label: t('settings.logout') || 'Logout',
      component: (
        <button
          onClick={handleLogoutClick}
          className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          {t('settings.logoutButton') || 'Logout'}
        </button>
      ),
    },
  ].slice(0, maxOptions);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {t('settings.title') || 'Settings'}
      </h1>

      <div className="space-y-4">
        {settingsOptions.map((option) => (
          <div
            key={option.id}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <label className="text-lg font-medium text-gray-900">
                {option.label}
              </label>
              <div>{option.component}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('settings.logoutConfirmTitle') || 'Confirm Logout'}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('settings.logoutConfirmMessage') || 'Are you sure you want to logout?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLogoutCancel}
                className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={isLoggingOut}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 px-4 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (t('settings.loggingOut') || 'Logging out...') : (t('settings.logoutButton') || 'Logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
