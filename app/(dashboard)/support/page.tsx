import { Suspense } from 'react';
import SupportPageClient from './SupportPageClient';

function SupportPageLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportPageLoading />}>
      <SupportPageClient />
    </Suspense>
  );
}


