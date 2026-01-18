'use client';

import React from 'react';
import { useMode } from '../contexts/ModeContext';

interface ModeToggleProps {
  position?: 'header' | 'settings';
  className?: string;
}

export function ModeToggle({ position = 'header', className = '' }: ModeToggleProps) {
  const { mode, toggleMode } = useMode();

  const handleToggle = () => {
    toggleMode();
  };

  return (
    <div
      className={`mode-toggle ${position} ${className}`}
      style={{
        position: position === 'header' ? 'fixed' : 'relative',
        top: position === 'header' ? '16px' : 'auto',
        right: position === 'header' ? '16px' : 'auto',
        zIndex: position === 'header' ? 1000 : 'auto',
      }}
    >
      <button
        onClick={handleToggle}
        className="mode-toggle-button"
        aria-label={`Switch to ${mode === 'simple' ? 'advanced' : 'simple'} mode`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          backgroundColor: '#FFFFFF',
          border: '2px solid #E5E7EB',
          borderRadius: '24px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }}
      >
        <span
          className="mode-icon"
          style={{
            fontSize: '20px',
            transition: 'transform 0.3s ease',
            transform: mode === 'simple' ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          {mode === 'simple' ? '🎯' : '⚙️'}
        </span>
        <span
          className="mode-label"
          style={{
            color: '#1F2937',
            userSelect: 'none',
          }}
        >
          {mode === 'simple' ? 'Simple' : 'Advanced'}
        </span>
      </button>
    </div>
  );
}
