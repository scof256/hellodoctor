'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Stethoscope, User } from 'lucide-react';
import { ProgressStepper, type Step } from '@/app/components/ProgressStepper';

type Role = 'doctor' | 'patient';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define onboarding steps
  const onboardingSteps: Step[] = [
    { id: 'role', label: 'Choose Role', description: 'Select your role' },
    { id: 'setup', label: 'Setup', description: 'Complete setup' },
  ];

  // Current step is 0 (role selection), will move to 1 after selection
  const currentStep = selectedRole ? 1 : 0;
  const completedSteps = selectedRole ? [0] : [];

  const handleRoleSelection = async () => {
    if (!selectedRole || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      // Redirect based on role
      if (selectedRole === 'doctor') {
        router.push('/doctor');
      } else {
        router.push('/patient');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Indicator */}
        <div className="mb-8 bg-white rounded-xl shadow-sm p-4">
          <ProgressStepper
            steps={onboardingSteps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            variant="dots"
            showLabels={true}
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to HelloDoctor</h1>
          <p className="text-gray-600 mt-2">
            Hi {user.firstName || 'there'}! Let&apos;s get you set up. How will you be using the platform?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Doctor Card */}
          <button
            onClick={() => setSelectedRole('doctor')}
            className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedRole === 'doctor'
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-full ${
                selectedRole === 'doctor' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
              }`}>
                <Stethoscope className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">I&apos;m a Doctor</h2>
            </div>
            <p className="text-gray-600 text-sm">
              Register your practice, receive patient connections via QR code, 
              and access AI-powered intake summaries before appointments.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Generate shareable QR codes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                View patient intake summaries
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Manage appointments & availability
              </li>
            </ul>
          </button>

          {/* Patient Card */}
          <button
            onClick={() => setSelectedRole('patient')}
            className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedRole === 'patient'
                ? 'border-green-500 bg-green-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-full ${
                selectedRole === 'patient' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
              }`}>
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">I&apos;m a Patient</h2>
            </div>
            <p className="text-gray-600 text-sm">
              Connect with doctors, complete AI-powered intake conversations, 
              and book appointments seamlessly.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Connect via doctor&apos;s QR code
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                AI-guided medical intake
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Easy appointment booking
              </li>
            </ul>
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={handleRoleSelection}
            disabled={!selectedRole || isSubmitting}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
              selectedRole && !isSubmitting
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Setting up...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
