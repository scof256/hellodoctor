'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function LandingPageRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/patient');
    }
  }, [isLoaded, isSignedIn, router]);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-medical-100 animate-pulse mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return null;
  }

  return null;
}
