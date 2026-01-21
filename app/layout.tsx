import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { TRPCReactProvider } from '@/trpc/react';
import { ModeProvider } from './contexts/ModeContext';
import { I18nProvider } from './components/I18nProvider';
import { OfflineBanner } from './components/OfflineBanner';
import { validateEnvironment } from '@/lib/env-validation';
import './globals.css';
import '@stream-io/video-react-sdk/dist/css/styles.css';

// Validate environment variables at module load time
// This ensures build fails if required variables are missing (Requirements 8.1, 8.5)
validateEnvironment();

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'HelloDoctor - AI-Powered Medical Intake Platform',
    template: '%s | HelloDoctor',
  },
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
  ],
  authors: [{ name: 'HelloDoctor' }],
  creator: 'HelloDoctor',
  publisher: 'HelloDoctor',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'HelloDoctor',
    title: 'HelloDoctor - AI-Powered Medical Intake Platform',
    description: 'Streamline your medical practice with AI-powered patient intake. Connect doctors and patients seamlessly.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HelloDoctor - AI-Powered Medical Intake Platform',
    description: 'Streamline your medical practice with AI-powered patient intake.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/patient"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en">
        <body className={inter.className}>
          <TRPCReactProvider>
            <I18nProvider>
              <ModeProvider>
                <OfflineBanner />
                {children}
              </ModeProvider>
            </I18nProvider>
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
