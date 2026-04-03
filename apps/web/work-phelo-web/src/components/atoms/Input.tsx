'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-bold text-gray-900">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 border rounded-xl text-sm bg-white text-gray-800',
            'placeholder:text-gray-400 transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400',
            error ? 'border-red-500' : 'border-gray-300',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
