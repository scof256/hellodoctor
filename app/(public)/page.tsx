import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  QrCode, 
  Shield, 
  Clock, 
  FileText,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { LandingPageRedirect } from '@/app/components/LandingPageClient';

export default function LandingPage() {
  return (
    <>
      <LandingPageRedirect />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medical-600 flex items-center justify-center text-white text-xl shadow-lg shadow-medical-200">
                ⚕️
              </div>
              <span className="font-bold text-xl text-slate-800">HelloDoctor</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/sign-in" 
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/get-started" 
                className="bg-medical-600 hover:bg-medical-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-medical-200"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-medical-50 text-medical-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Medical Intake Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Streamline Your Practice with{' '}
              <span className="text-medical-600">Intelligent</span> Patient Intake
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Connect doctors and patients seamlessly. AI-powered intake conversations gather comprehensive medical history before appointments, saving time and improving care.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/get-started" 
                className="w-full sm:w-auto bg-medical-600 hover:bg-medical-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-xl shadow-medical-200 hover:shadow-2xl hover:shadow-medical-300 flex items-center justify-center gap-2"
              >
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/sign-in" 
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-slate-200 shadow-lg"
              >
                Sign In to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-medical-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-1">85%</div>
              <div className="text-medical-100 text-sm">Time Saved on Intake</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-1">10k+</div>
              <div className="text-medical-100 text-sm">Patients Served</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-1">500+</div>
              <div className="text-medical-100 text-sm">Healthcare Providers</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-1">4.9★</div>
              <div className="text-medical-100 text-sm">User Satisfaction</div>
            </div>
          </div>
        </div>
      </section>


      {/* Features for Doctors */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              For Healthcare Providers
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful tools to manage your practice efficiently and provide better patient care
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<QrCode className="w-6 h-6" />}
              title="QR Code Patient Connection"
              description="Generate unique QR codes for your practice. Patients scan to connect instantly - no manual data entry required."
              color="medical"
            />
            <FeatureCard 
              icon={<Sparkles className="w-6 h-6" />}
              title="AI-Powered Intake"
              description="Our AI assistant conducts thorough medical intake conversations, gathering comprehensive patient history before appointments."
              color="medical"
            />
            <FeatureCard 
              icon={<FileText className="w-6 h-6" />}
              title="Clinical Handover Reports"
              description="Receive SBAR-formatted clinical summaries with all relevant patient information organized for quick review."
              color="medical"
            />
            <FeatureCard 
              icon={<Calendar className="w-6 h-6" />}
              title="Smart Scheduling"
              description="Manage your availability with flexible scheduling. Patients book appointments that fit your calendar."
              color="medical"
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Team Management"
              description="Add clinic admins and receptionists to help manage your practice. Control access with role-based permissions."
              color="medical"
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6" />}
              title="Verified Provider Badge"
              description="Get verified to build trust with patients. Display your credentials and professional certifications."
              color="medical"
            />
          </div>
        </div>
      </section>

      {/* Features for Patients */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              For Patients
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A seamless healthcare experience from connection to appointment
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<QrCode className="w-6 h-6" />}
              title="Easy Doctor Connection"
              description="Scan your doctor's QR code or use their link to connect instantly. No paperwork, no hassle."
              color="indigo"
            />
            <FeatureCard 
              icon={<MessageSquare className="w-6 h-6" />}
              title="Conversational Intake"
              description="Chat with our AI assistant at your own pace. Share your medical history through a friendly conversation."
              color="indigo"
            />
            <FeatureCard 
              icon={<Clock className="w-6 h-6" />}
              title="Save Time at Appointments"
              description="Complete intake before your visit. Spend more time with your doctor discussing what matters."
              color="indigo"
            />
            <FeatureCard 
              icon={<Calendar className="w-6 h-6" />}
              title="Online Booking"
              description="Book appointments with your connected doctors anytime. See available slots and choose what works for you."
              color="indigo"
            />
            <FeatureCard 
              icon={<MessageSquare className="w-6 h-6" />}
              title="Direct Messaging"
              description="Send messages to your healthcare providers. Get answers to questions between appointments."
              color="indigo"
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6" />}
              title="Secure & Private"
              description="Your medical information is encrypted and protected. You control who sees your data."
              color="indigo"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number={1}
              title="Connect"
              description="Doctors share their QR code or link. Patients scan to connect and create their account."
            />
            <StepCard 
              number={2}
              title="Complete Intake"
              description="Patients chat with our AI assistant to share their medical history and reason for visit."
            />
            <StepCard 
              number={3}
              title="Book & Meet"
              description="Schedule an appointment. Doctors receive a complete clinical summary before the visit."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-medical-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-lg text-medical-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of healthcare providers who are saving time and improving patient care with HelloDoctor.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/get-started" 
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-medical-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-xl flex items-center justify-center gap-2"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/sign-in" 
              className="w-full sm:w-auto bg-medical-700 hover:bg-medical-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-medical-500"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medical-600 flex items-center justify-center text-white text-xl">
                ⚕️
              </div>
              <span className="font-bold text-xl text-white">HelloDoctor</span>
            </div>
            <div className="text-slate-400 text-sm">
              © {new Date().getFullYear()} HelloDoctor. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  color 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  color: 'medical' | 'indigo';
}) {
  const colorClasses = {
    medical: 'bg-medical-50 text-medical-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function StepCard({ 
  number, 
  title, 
  description 
}: { 
  number: number; 
  title: string; 
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-medical-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg shadow-medical-200">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}
