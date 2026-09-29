'use client';

import { forwardRef, useState } from 'react';
import { inputClass, isValidEmail } from '@/lib/utils';

interface EmailFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** An external error (e.g. "Email is required.") always wins over the field's own format check. */
  error?: string;
  placeholder?: string;
  className?: string;
}

/**
 * A standard email input: lowercases as you type, and shows "Enter a valid email address."
 * once the field has been blurred with a non-empty, malformed value. Use this instead of a
 * plain `<input type="email">` wherever the app collects an email — both rules travel with the
 * component rather than needing to be re-implemented per form. See [[feedback-email-field-lowercase]].
 */
export const EmailField = forwardRef<HTMLInputElement, EmailFieldProps>(
  ({ label, value, onChange, error, placeholder = 'email@example.com', className }, ref) => {
    const [touched, setTouched] = useState(false);

    const formatError =
      touched && value.trim() && !isValidEmail(value) ? 'Enter a valid email address.' : undefined;
    const shownError = error ?? formatError;

    return (
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        {label && <label className="text-sm font-bold text-gray-900">{label}</label>}
        <input
          ref={ref}
          type="email"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          onBlur={() => setTouched(true)}
          className={inputClass(shownError, className)}
        />
        {shownError && <p className="text-xs text-red-500">{shownError}</p>}
      </div>
    );
  },
);

EmailField.displayName = 'EmailField';
