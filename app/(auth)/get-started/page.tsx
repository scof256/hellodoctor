'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, User, ArrowRight, ArrowLeft } from 'lucide-react';

type Role = 'doctor' | 'patient';

export default function GetStartedPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleContinue = () => {
    if (!selectedRole) return;
    // Go to sign-up with role param
    router.push(`/sign-up?role=${selectedRole}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Back to home */}
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-medical-600 flex items-center justify-center text-white text-3xl shadow-lg shadow-medical-200 mx-auto mb-4">
            ⚕️
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Join HelloDoctor
          </h1>
          <p className="text-gray-600 mt-2">
            How will you be using the platform?
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

        <div className="mt-8 text-center">
          <button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 inline-flex items-center gap-2 ${
              selectedRole
                ? 'bg-medical-600 text-white hover:bg-medical-700 shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-medical-600 hover:text-medical-700 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
