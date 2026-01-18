import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).substring(2, 8);
}

export function calculateCompleteness(medicalData: {
  chiefComplaint: string | null;
  hpi: string | null;
  medications: string[];
  allergies: string[];
  pastMedicalHistory: string[];
  familyHistory: string | null;
  socialHistory: string | null;
  recordsCheckCompleted: boolean;
}): number {
  const fields = [
    'chiefComplaint', 'hpi', 'medications', 'allergies',
    'pastMedicalHistory', 'familyHistory', 'socialHistory'
  ] as const;
  
  let filled = 0;
  
  for (const field of fields) {
    const val = medicalData[field];
    if (Array.isArray(val)) {
      if (val.length > 0) filled++;
    } else {
      if (val) filled++;
    }
  }
  
  if (medicalData.recordsCheckCompleted) filled += 0.5;
  
  return Math.min(100, Math.round((filled / fields.length) * 100));
}
