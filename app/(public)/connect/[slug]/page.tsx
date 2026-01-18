import { Metadata } from 'next';
import { db } from '@/server/db';
import { doctors, users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import DoctorProfileClient from './DoctorProfileClient';
import { generateDoctorShareUrl } from '@/server/services/qr';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Helper function to fetch doctor data
async function getDoctorBySlug(slug: string) {
  try {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.slug, slug),
    });

    if (!doctor) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, doctor.userId),
    });

    if (!user) {
      return null;
    }

    return {
      id: doctor.id,
      slug: doctor.slug,
      specialty: doctor.specialty,
      clinicName: doctor.clinicName,
      bio: doctor.bio,
      verificationStatus: doctor.verificationStatus as 'pending' | 'verified' | 'rejected',
      appointmentDuration: doctor.appointmentDuration,
      consultationFee: doctor.consultationFee,
      acceptsPayments: doctor.acceptsPayments,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
      },
      shareUrl: generateDoctorShareUrl(doctor.slug),
      qrCodeUrl: doctor.qrCodeUrl,
    };
  } catch {
    return null;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    return {
      title: 'Doctor Not Found',
      description: 'The doctor profile you are looking for does not exist.',
    };
  }

  const fullName = [doctor.user.firstName, doctor.user.lastName].filter(Boolean).join(' ') || 'Doctor';
  const title = `Dr. ${fullName}${doctor.specialty ? ` - ${doctor.specialty}` : ''}`;
  const description = doctor.bio 
    ? doctor.bio.substring(0, 160) 
    : `Connect with Dr. ${fullName}${doctor.specialty ? `, ${doctor.specialty}` : ''} on HelloDoctor. Book appointments and complete your medical intake online.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | HelloDoctor`,
      description,
      type: 'profile',
      images: doctor.user.imageUrl ? [{ url: doctor.user.imageUrl, alt: `Dr. ${fullName}` }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${title} | HelloDoctor`,
      description,
      images: doctor.user.imageUrl ? [doctor.user.imageUrl] : undefined,
    },
    robots: {
      index: doctor.verificationStatus === 'verified',
      follow: true,
    },
  };
}

export default async function DoctorPublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  
  // Pre-fetch doctor data on the server to avoid client-side tRPC call
  const initialData = await getDoctorBySlug(slug);
  
  return <DoctorProfileClient slug={slug} initialData={initialData} />;
}
