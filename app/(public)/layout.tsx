import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HelloDoctor - AI-Powered Medical Intake Platform',
  description: 'Streamline your medical practice with AI-powered patient intake. Connect doctors and patients seamlessly with intelligent medical history gathering and appointment booking.',
  keywords: [
    'medical intake',
    'AI healthcare',
    'doctor appointment',
    'patient management',
    'clinical handover',
    'healthcare SaaS',
    'medical practice management',
    'telemedicine',
    'online doctor booking',
    'patient intake form',
  ],
  openGraph: {
    title: 'HelloDoctor - AI-Powered Medical Intake Platform',
    description: 'Streamline your medical practice with AI-powered patient intake. Connect doctors and patients seamlessly.',
    type: 'website',
    locale: 'en_US',
    siteName: 'HelloDoctor',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HelloDoctor - AI-Powered Medical Intake Platform',
    description: 'Streamline your medical practice with AI-powered patient intake.',
  },
  alternates: {
    canonical: '/',
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
