'use client';

import { Toggle } from '@/components/atoms/Toggle';

interface Props {
  label: string;
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  /** When both are passed, a "Required" toggle shows beside Include while the field is included. */
  required?: boolean;
  onRequiredChange?: (required: boolean) => void;
  /** The field itself. Not rendered while the field is excluded; its value is kept. */
  children: React.ReactNode;
}

/** A bordered field block: label on the left and an "Include" toggle at the top right. */
export function IncludeToggleField({
  label,
  included,
  onIncludedChange,
  required,
  onRequiredChange,
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-gray-900">{label}</span>
        <div className="flex items-center gap-4">
          {included && required !== undefined && onRequiredChange && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Required
              <Toggle enabled={required} onChange={onRequiredChange} />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Include
            <Toggle enabled={included} onChange={onIncludedChange} />
          </label>
        </div>
      </div>
      {included && children}
    </div>
  );
}
