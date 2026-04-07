'use client';

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

const COUNTRY_CODES = [
  { code: '+233', flag: 'GH' },
  { code: '+1', flag: 'US' },
  { code: '+44', flag: 'GB' },
  { code: '+27', flag: 'ZA' },
  { code: '+234', flag: 'NG' },
  { code: '+254', flag: 'KE' },
];

interface PhoneInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultCountryCode?: string;
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      label,
      error,
      placeholder = '00 000 0000',
      value,
      onChange,
      defaultCountryCode = '+233',
      className,
    },
    ref,
  ) => {
    const [countryCode, setCountryCode] = useState(defaultCountryCode);
    const [localValue, setLocalValue] = useState(value ?? '');

    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-bold text-gray-900">{label}</label>}
        <div
          className={cn(
            'flex border rounded-input overflow-hidden bg-white transition-colors',
            'focus-within:ring-1 focus-within:ring-gray-400 focus-within:border-gray-400',
            error ? 'border-red-500' : 'border-gray-300',
            className,
          )}
        >
          {/* Country code selector */}
          <div className="relative flex items-center border-r border-gray-300 px-3 bg-white shrink-0">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="appearance-none bg-transparent text-sm text-gray-800 pr-5 focus:outline-none cursor-pointer"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 text-gray-400">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Number input */}
          <input
            ref={ref}
            type="tel"
            value={localValue}
            onChange={(e) => {
              const numeric = e.target.value.replace(/\D/g, '').slice(0, 10);
              setLocalValue(numeric);
              onChange?.(numeric);
            }}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
