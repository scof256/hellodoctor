'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const role = searchParams.get('role');
  const redirectUrl = searchParams.get('redirect_url');
  const [isSettingUp, setIsSettingUp] = useState(false);

  // After sign-in, check user's role and redirect appropriately
  useEffect(() => {
    const handlePostSignIn = async () => {
      if (!isLoaded || !isSignedIn || isSettingUp) return;
      
      // If coming from doctor's URL (has redirect_url to /connect/), go there
      if (redirectUrl?.includes('/connect/')) {
        router.push(redirectUrl);
        return;
      }

      // If role is specified (coming from get-started), create profile
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
            router.push(role === 'doctor' ? '/doctor' : '/patient');
          }
        } catch {
          router.push(role === 'doctor' ? '/doctor' : '/patient');
        }
        return;
      }

      // No role specified - check if user exists in DB and redirect based on their role
      setIsSettingUp(true);
      try {
        const response = await fetch('/api/auth/onboarding', {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          // User exists, redirect based on their role
          if (data.role === 'super_admin') {
            router.push('/admin');
          } else if (data.role === 'doctor') {
            router.push('/doctor');
          } else {
            router.push('/patient');
          }
        } else if (response.status === 404) {
          // User doesn't exist in DB, send to onboarding
          router.push('/onboarding');
        } else {
          router.push('/onboarding');
        }
      } catch {
        router.push('/onboarding');
      }
    };

    handlePostSignIn();
  }, [isLoaded, isSignedIn, role, redirectUrl, router, isSettingUp]);

  // Show loading while setting up profile
  if (isSignedIn) {
    return (
      <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-medical-600 mx-auto mb-4" />
          <p className="text-slate-600">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div suppressHydrationWarning className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">
            Sign in to access your dashboard
          </p>
        </div>
        <SignIn 
          fallbackRedirectUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
              footer: 'hidden', // Hide Clerk's footer with "Sign up" link
              footerAction: 'hidden',
              footerActionLink: 'hidden',
            },
          }}
        />
        <div className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/get-started" className="text-medical-600 hover:text-medical-700 font-medium">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
