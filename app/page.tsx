import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import LandingPage from './(public)/page';

export default async function Home() {
  const { userId } = await auth();
  
  // Redirect authenticated users to their dashboard
  if (userId) {
    redirect('/patient');
  }
  
  return <LandingPage />;
}
