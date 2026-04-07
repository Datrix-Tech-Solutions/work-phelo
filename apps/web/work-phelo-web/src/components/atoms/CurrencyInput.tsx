'use client';

import { cn } from '@/lib/utils';

const CURRENCIES = [
  { code: 'GHS', symbol: '₵' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'NGN', symbol: '₦' },
  { code: 'KES', symbol: 'KSh' },
];

interface CurrencyInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: number | string;
  currency?: string;
  onValueChange?: (value: string) => void;
  onCurrencyChange?: (currency: string) => void;
}

export function CurrencyInput({
  label,
  error,
  placeholder = '0.00',
  value,
  currency = 'GHS',
  onValueChange,
  onCurrencyChange,
}: CurrencyInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}
      <div
        className={cn(
          'flex border rounded-input overflow-hidden bg-white transition-colors',
          'focus-within:ring-1 focus-within:ring-gray-400 focus-within:border-gray-400',
          error ? 'border-red-500' : 'border-gray-300',
        )}
      >
        {/* Currency selector */}
        <div className="relative flex items-center border-r border-gray-300 px-3 bg-white shrink-0">
          <select
            value={currency}
            onChange={(e) => onCurrencyChange?.(e.target.value)}
            className="appearance-none bg-transparent text-sm text-gray-800 pr-5 focus:outline-none cursor-pointer"
          >
            {CURRENCIES.map((c) => (
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

        {/* Amount input */}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value ?? ''}
          onChange={(e) => onValueChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
