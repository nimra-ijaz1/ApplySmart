import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined) return 'N/A';
  if (amount === 0) return `0 ${currency} (Tuition-free / Waived)`;
  return `${amount.toLocaleString('en-US')} ${currency}`;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'Not specified';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const GENERATED_IMAGES = {
  heroCampus: '/src/assets/images/hero_campus_library_1795192168773.jpg',
  studyDesk: '/src/assets/images/study_abroad_desk_1795192168795.jpg',
  studentAvatar: '/src/assets/images/avatar_student_profile_1795192169038.jpg',
};
