'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { handleButtonPress } from '@/app/lib/button-feedback';
import { useLocalization } from '@/app/hooks/useLocalization';

export interface BackButtonProps {
  /**
   * Custom onClick handler. If provided, overrides default back navigation.
   */
  onClick?: () => void;
  /**
   * Custom label for the button. Defaults to "Back".
   */
  label?: string;
  /**
   * Whether to show the label text. Defaults to false (icon only).
   */
  showLabel?: boolean;
  /**
   * Custom className for styling.
   */
  className?: string;
  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;
}

/**
 * BackButton component that displays a back arrow button.
 * Automatically handles navigation history.
 * Should be displayed on all screens except the home screen.
 * 
 * Requirements: 3.3, 14.1
 * Property: 10 - Back Button Presence
 */
export function BackButton({
  onClick,
  label,
  showLabel = false,
  className = '',
  disabled = false,
}: BackButtonProps) {
  const router = useRouter();
  const { t } = useLocalization();
  const defaultLabel = label ?? t('navigation.back', 'Back');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    handleButtonPress(e, { ripple: true, haptic: true });
    
    if (onClick) {
      onClick();
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleClick}
      disabled={disabled}
      className={`back-button btn-ripple ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: showLabel ? '8px 16px' : '8px',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#9CA3AF' : '#374151',
        fontSize: '16px',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        minWidth: '48px',
        minHeight: '48px',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-label={defaultLabel}
      data-testid="back-button"
    >
      <ArrowLeft className="w-6 h-6" aria-hidden="true" />
      {showLabel && <span>{defaultLabel}</span>}
    </button>
  );
}

/**
 * Hook to determine if the back button should be shown on the current page.
 * Returns true for all pages except home screens.
 */
export function useShowBackButton(): boolean {
  const pathname = usePathname();
  
  // Home screens where back button should NOT be shown
  const homeScreens = [
    '/patient',
    '/doctor',
    '/admin',
    '/',
  ];
  
  return !homeScreens.includes(pathname ?? '');
}
