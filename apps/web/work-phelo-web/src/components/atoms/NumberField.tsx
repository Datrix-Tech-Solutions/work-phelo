'use client';

import { useState, useEffect } from 'react';
import { cn, inputClass } from '@/lib/utils';

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Fired on blur with the committed numeric value — useful for normalising
   * (e.g. rounding to 2 decimals) without fighting the user while they type. */
  onBlur?: (value: number) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  /** Accessible name for a field that has no visible label of its own. */
  ariaLabel?: string;
  /** Decimal places shown once blurred, and typed at most. 0 gives a whole-number field
   * (e.g. an odometer reading). Defaults to 2. */
  decimals?: number;
  /** Show the value as typed once blurred ("1" stays 1, "1.5" stays 1.5) instead of padding it to
   * `decimals` places. `decimals` still limits what can be stored. For quantities. */
  keepTyped?: boolean;
}

/** Text input that shows raw digits while focused and a thousands-formatted,
 * 2-decimal value once blurred — for editable currency/amount cells. */
export function NumberField({
  value,
  onChange,
  onBlur,
  decimals = 2,
  keepTyped,
  placeholder = decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0',
  className,
  label,
  error,
  disabled,
  ariaLabel,
}: NumberFieldProps) {
  const [local, setLocal] = useState(() => (value === 0 ? '' : String(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const numeric = local === '' ? 0 : Number(local);
    if (value !== numeric) setLocal(value === 0 ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const displayValue =
    focused || local === ''
      ? local
      : Number(local).toLocaleString(undefined, {
          minimumFractionDigits: keepTyped
            ? Math.min(local.split('.')[1]?.length ?? 0, decimals)
            : decimals,
          maximumFractionDigits: decimals,
        });

  const input = (
    <input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={displayValue}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.(local === '' ? 0 : Number(local));
      }}
      onChange={(e) => {
        let raw = e.target.value.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, '');
        // A kept-as-typed field stops at its decimal places rather than storing digits it can't show.
        if (keepTyped && raw.includes('.')) {
          const [whole, ...rest] = raw.split('.');
          raw = `${whole}.${rest.join('').slice(0, decimals)}`;
        }
        setLocal(raw);
        onChange(raw === '' ? 0 : Number(raw));
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={inputClass(error, cn(label ? 'w-full' : 'w-28 py-1.5', className))}
    />
  );

  if (!label && !error) return input;

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      {label && (
        <label className="block truncate text-sm font-bold text-gray-900" title={label}>
          {label}
        </label>
      )}
      {input}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
