'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/trpc/react';
import { 
  Stethoscope, 
  MapPin, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  Loader2,
  UserPlus,
  Shield,
  Briefcase
} from 'lucide-react';

interface DoctorProfileClientProps {
  slug: string;
  initialData?: {
    id: string;
    slug: string;
    specialty: string | null;
    clinicName: string | null;
    bio: string | null;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    appointmentDuration: number;
    consultationFee: number | null;
    acceptsPayments: boolean;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
    shareUrl: string;
    qrCodeUrl: string | null;
  } | null;
}

interface ViewerRole {
  isDoctor: boolean;
  isLoading: boolean;
}

export default function DoctorProfileClient({ slug, initialData }: DoctorProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false);
  const [viewerRole, setViewerRole] = useState<ViewerRole>({ isDoctor: false, isLoading: true });

  // Check if coming from QR scan (can add utm param or detect)
  const source = searchParams.get('source') === 'qr' ? 'qr_scan' : 'direct_url';

  // Fetch doctor profile by slug (with initial data from server)
  // Skip the query entirely if we have initialData to avoid unnecessary tRPC calls
  const { data: doctor, isLoading, error } = api.doctor.getBySlug.useQuery(
    { slug },
    { 
      enabled: !!slug && !initialData, // Skip query if we have initial data
      initialData: initialData ?? undefined,
      retry: false, // Don't retry on 404 errors
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      staleTime: initialData ? Infinity : 0, // Keep initial data fresh
    }
  );

  // Check viewer's role when signed in (Requirements 2.1, 2.3)
  useEffect(() => {
    const checkViewerRole = async () => {
      if (!isSignedIn || !isLoaded) {
        setViewerRole({ isDoctor: false, isLoading: false });
        return;
      }

      try {
        const response = await fetch('/api/auth/onboarding');
        if (response.ok) {
          const data = await response.json();
          // Check if user has doctor profile or primary_role is doctor
          const isDoctor = data.hasDoctorProfile || data.primaryRole === 'doctor';
          setViewerRole({ isDoctor, isLoading: false });
        } else {
          setViewerRole({ isDoctor: false, isLoading: false });
        }
      } catch {
        setViewerRole({ isDoctor: false, isLoading: false });
      }
    };

    checkViewerRole();
  }, [isSignedIn, isLoaded]);

  // Auto-connect when user is signed in and doctor is loaded (skip for doctor viewers)
  useEffect(() => {
    const autoConnect = async () => {
      // Skip auto-connect for doctor viewers (Requirements 2.1, 5.1)
      if (viewerRole.isLoading || viewerRole.isDoctor) {
        return;
      }

      if (!isSignedIn || !isLoaded || !doctor || isConnecting || hasAttemptedAutoConnect) {
        return;
      }

      setHasAttemptedAutoConnect(true);
      setIsConnecting(true);
      setConnectError(null);

      try {
        const response = await fetch('/api/auth/auto-patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: doctor.id,
            connectionSource: source,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle 403 for doctors gracefully (Requirements 2.2, 5.2)
          if (response.status === 403 && data.isDoctor) {
            setViewerRole({ isDoctor: true, isLoading: false });
            setIsConnecting(false);
            return;
          }
          throw new Error(data.error || 'Failed to connect');
        }

        // Small delay to ensure patient profile is fully propagated before redirect
        await new Promise(resolve => setTimeout(resolve, 500));

        // Redirect to intake chat (use API response)
        router.push(data.redirectTo);
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : 'Failed to connect');
        setIsConnecting(false);
      }
    };

    autoConnect();
  }, [isSignedIn, isLoaded, doctor, isConnecting, hasAttemptedAutoConnect, source, router, viewerRole]);

  // Manual connect handler (fallback)
  const handleConnect = async () => {
    if (!doctor || isConnecting || viewerRole.isDoctor) return;
    
    setIsConnecting(true);
    setConnectError(null);

    try {
      const response = await fetch('/api/auth/auto-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: doctor.id,
          connectionSource: source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 403 for doctors gracefully (Requirements 2.2, 5.2)
        if (response.status === 403 && data.isDoctor) {
          setViewerRole({ isDoctor: true, isLoading: false });
          setIsConnecting(false);
          return;
        }
        throw new Error(data.error || 'Failed to connect');
      }

      // Small delay to ensure patient profile is fully propagated before redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      router.push(data.redirectTo);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  };

  // Loading state
  if (!isLoaded || isLoading || (isSignedIn && viewerRole.isLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading doctor profile...</span>
        </div>
      </div>
    );
  }

  // Show connecting state when auto-connecting (only for non-doctor viewers)
  if (isSignedIn && isConnecting && !viewerRole.isDoctor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-medical-600 mx-auto mb-4" />
          <p className="text-slate-600">Setting up your connection...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !doctor) {
    const isNotFound = error?.data?.code === 'NOT_FOUND' || error?.message?.includes('not found');
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isNotFound ? 'Doctor Not Found' : 'Something Went Wrong'}
          </h1>
          <p className="text-slate-600 mb-6">
            {isNotFound 
              ? "The doctor profile you're looking for doesn't exist or may have been removed."
              : "We couldn't load this doctor's profile. Please try again later."
            }
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-medical-600 hover:text-medical-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 bg-medical-600 hover:bg-medical-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Get Started
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fullName = [doctor.user.firstName, doctor.user.lastName].filter(Boolean).join(' ') || 'Doctor';
  const isVerified = doctor.verificationStatus === 'verified';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medical-600 flex items-center justify-center text-white text-xl shadow-lg shadow-medical-200">
                ⚕️
              </div>
              <span className="font-bold text-xl text-slate-800">HelloDoctor</span>
            </Link>
            {!isSignedIn && (
              <Link 
                href="/sign-in" 
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Profile Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-medical-600 to-medical-700 px-6 sm:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Profile Image */}
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white shadow-lg flex items-center justify-center overflow-hidden">
                {doctor.user.imageUrl ? (
                  <img 
                    src={doctor.user.imageUrl} 
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Stethoscope className="w-12 h-12 text-medical-600" />
                )}
              </div>
              
              {/* Name and Specialty */}
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    Dr. {fullName}
                  </h1>
                  {isVerified && (
                    <div className="flex items-center gap-1 bg-white/20 text-white px-2 py-1 rounded-full text-xs font-medium">
                      <Shield className="w-3 h-3" />
                      Verified
                    </div>
                  )}
                </div>
                {doctor.specialty && (
                  <p className="text-medical-100 text-lg">{doctor.specialty}</p>
                )}
                {doctor.clinicName && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-medical-200">
                    <MapPin className="w-4 h-4" />
                    <span>{doctor.clinicName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="px-6 sm:px-8 py-8">
            {/* Bio */}
            {doctor.bio && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">About</h2>
                <p className="text-slate-600 leading-relaxed">{doctor.bio}</p>
              </div>
            )}

            {/* Appointment Info */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Appointment Details</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg">
                  <Clock className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-700">{doctor.appointmentDuration} min sessions</span>
                </div>
                {doctor.consultationFee !== null && doctor.consultationFee > 0 && (
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg">
                    <span className="text-slate-700">
                      ${(doctor.consultationFee / 100).toFixed(2)} per visit
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Status Warning */}
            {!isVerified && (
              <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-medium">Verification Pending</p>
                  <p className="text-amber-700 text-sm">
                    This doctor&apos;s credentials are currently being verified. You can still connect, but we recommend waiting for verification.
                  </p>
                </div>
              </div>
            )}

            {/* Connect Button */}
            <div className="border-t border-slate-200 pt-8">
              {isSignedIn ? (
                viewerRole.isDoctor ? (
                  // Doctor viewer - show professional message (Requirements 2.1, 5.1)
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-blue-900 mb-1">
                          Viewing as Healthcare Provider
                        </h3>
                        <p className="text-blue-700 mb-4">
                          You&apos;re viewing this profile as a fellow healthcare professional. 
                          Patient connection features are not available for doctor accounts.
                        </p>
                        <Link
                          href="/doctor"
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          <Stethoscope className="w-4 h-4" />
                          Go to Doctor Dashboard
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Patient viewer - show connect button
                  <div>
                    {connectError && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-700">{connectError}</p>
                      </div>
                    )}
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="w-full sm:w-auto bg-medical-600 hover:bg-medical-700 disabled:bg-medical-400 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-medical-200 flex items-center justify-center gap-2"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5" />
                          Connect with Dr. {doctor.user.lastName || fullName}
                        </>
                      )}
                    </button>
                  </div>
                )
              ) : (
                <div className="bg-slate-50 rounded-xl p-6 text-center">
                  <p className="text-slate-600 mb-4">
                    Sign in or create an account to connect with Dr. {fullName}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={`/sign-up?redirect_url=/connect/${slug}${source === 'qr_scan' ? '?source=qr' : ''}`}
                      className="w-full sm:w-auto bg-medical-600 hover:bg-medical-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-medical-200 flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-5 h-5" />
                      Create Account
                    </Link>
                    <Link
                      href={`/sign-in?redirect_url=/connect/${slug}${source === 'qr_scan' ? '?source=qr' : ''}`}
                      className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-all border border-slate-200"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
