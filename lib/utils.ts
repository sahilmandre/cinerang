import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes — the standard shadcn-style `cn` helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
