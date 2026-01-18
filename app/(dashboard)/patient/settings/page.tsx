'use client';

import { SimplifiedSettings } from '@/app/components/SimplifiedSettings';
import { useRouter, usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import React from 'react';
import { getLogoutRedirectUrl } from '@/app/lib/auth-utils';

/**
 * Patient Settings Page
 * Uses SimplifiedSettings component for Simple Mode
 * Requirements: 11.3, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 5.2, 5.3, 5.4
 */
export default function PatientSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();

  const handleLogout = async () => {
    try {
      // Call Clerk's signOut function
      await signOut();
      
      // Use role-based redirect helper (Requirements: 5.2, 5.3, 5.4)
      const redirectUrl = getLogoutRedirectUrl(pathname);
      router.push(redirectUrl);
    } catch (error) {
      // Error will be caught and handled by SimplifiedSettings
      console.error('Logout error in settings page:', error);
      throw error; // Re-throw to let SimplifiedSettings handle the toast
    }
  };

  return <SimplifiedSettings onLogout={handleLogout} />;
}
