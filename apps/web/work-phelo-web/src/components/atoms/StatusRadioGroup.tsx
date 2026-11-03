'use client';

import { useId } from 'react';

export type ActiveStatus = 'ACTIVE' | 'INACTIVE';

const OPTIONS: { value: ActiveStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface StatusRadioGroupProps {
  value: ActiveStatus;
  onChange: (value: ActiveStatus) => void;
  label?: string;
}

/** Labelled Active / Inactive radio pair for record forms. The radio row is as tall as a text
 *  input, so it lines up with a neighbouring field. */
export function StatusRadioGroup({ value, onChange, label = 'Status' }: StatusRadioGroupProps) {
  const name = useId();
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex h-9.5 items-center gap-6">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-900"
          >
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="h-4 w-4 accent-brand"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
