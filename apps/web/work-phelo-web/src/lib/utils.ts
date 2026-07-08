import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inputClass(error?: string, extra?: string) {
  return cn(
    'w-full px-4 py-3 border rounded-input text-sm bg-white text-gray-800',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400',
    error ? 'border-red-500' : 'border-gray-300',
    extra,
  );
}

export function cardClass(extra?: string, border: 'module' | 'glass' = 'module') {
  return cn(
    'bg-white/20 backdrop-blur-md rounded-xl border shadow-lg',
    border === 'module' ? 'border-(--module-border,var(--color-gray-200))' : 'border-white/40',
    extra,
  );
}
