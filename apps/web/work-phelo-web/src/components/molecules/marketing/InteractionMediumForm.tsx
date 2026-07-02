'use client';

import { inputClass } from '@/lib/utils';

export interface InteractionMediumFields {
  name: string;
  description: string;
}

interface Props {
  values: InteractionMediumFields;
  onChange: (values: InteractionMediumFields) => void;
  errors?: Partial<InteractionMediumFields>;
}

export function InteractionMediumForm({ values, onChange, errors }: Props) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Name</label>
        <input
          type="text"
          placeholder="e.g. Email"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className={inputClass(errors?.name)}
        />
        {errors?.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Description</label>
        <textarea
          rows={4}
          placeholder="Brief description"
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          className={inputClass(errors?.description) + ' resize-none'}
        />
        {errors?.description && <p className="text-xs text-red-500">{errors.description}</p>}
      </div>
    </div>
  );
}
