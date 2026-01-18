'use client';

import { SignUp, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const role = searchParams.get('role');
  const redirectUrl = searchParams.get('redirect_url');
  const [isSettingUp, setIsSettingUp] = useState(false);

  // After sign-up, create profile based on role
  useEffect(() => {
    const setupProfile = async () => {
      if (!isLoaded || !isSignedIn || isSettingUp) return;
      
      // If coming from doctor's URL (has redirect_url to /connect/), skip role setup
      if (redirectUrl?.includes('/connect/')) {
        router.push(redirectUrl);
        return;
      }

      // If role is specified, create profile
      if (role === 'doctor' || role === 'patient') {
        setIsSettingUp(true);
        try {
          const response = await fetch('/api/auth/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          });

          if (response.ok) {
            const data = await response.json();
            router.push(data.redirectTo || (role === 'doctor' ? '/doctor' : '/patient'));
          } else {
            // User might already exist, redirect based on role
            router.push(role === 'doctor' ? '/doctor' : '/patient');
          }
        } catch {
          router.push(role === 'doctor' ? '/doctor' : '/patient');
        }
      } else {
        // No role specified, go to onboarding
        router.push('/onboarding');
      }
    };

    setupProfile();
  }, [isLoaded, isSignedIn, role, redirectUrl, router, isSettingUp]);

  // Show loading while setting up profile
  if (isSignedIn && (role || redirectUrl)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-medical-600 mx-auto mb-4" />
          <p className="text-slate-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Build the redirect URL for after sign-up
  const afterSignUpUrl = redirectUrl 
    ? redirectUrl 
    : role 
      ? `/sign-up?role=${role}` 
      : '/onboarding';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">
            {role === 'doctor' 
              ? 'Register as a healthcare provider' 
              : role === 'patient'
                ? 'Create your patient account'
                : 'Join our medical platform today'}
          </p>
        </div>
        <SignUp 
          fallbackRedirectUrl={afterSignUpUrl}
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
              footer: 'hidden', // Hide Clerk's footer with "Sign in" link
              footerAction: 'hidden',
              footerActionLink: 'hidden',
            },
          }}
        />
        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-medical-600 hover:text-medical-700 font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
