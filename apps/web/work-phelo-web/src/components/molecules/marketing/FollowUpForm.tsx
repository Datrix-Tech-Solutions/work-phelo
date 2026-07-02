'use client';

import { inputClass } from '@/lib/utils';
import { DatePicker } from '@/components/atoms/DatePicker';

export interface FollowUpFields {
  prospectName: string;
  followUpDate: string;
  notes: string;
}

interface Props {
  values: FollowUpFields;
  onChange: (values: FollowUpFields) => void;
  errors?: Partial<FollowUpFields>;
}

export function FollowUpForm({ values, onChange, errors }: Props) {
  function set<K extends keyof FollowUpFields>(key: K, val: string) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Prospect Name</label>
        <input
          type="text"
          placeholder="eg; Acme Corporation"
          value={values.prospectName}
          onChange={(e) => set('prospectName', e.target.value)}
          className={inputClass(errors?.prospectName)}
        />
        {errors?.prospectName && <p className="text-xs text-red-500">{errors.prospectName}</p>}
      </div>

      <DatePicker
        label="Follow-up Date"
        value={values.followUpDate}
        onChange={(v) => set('followUpDate', v)}
        error={errors?.followUpDate}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Notes</label>
        <textarea
          rows={4}
          placeholder="What needs to be followed up on?"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputClass(errors?.notes, 'resize-none')}
        />
        {errors?.notes && <p className="text-xs text-red-500">{errors.notes}</p>}
      </div>
    </div>
  );
}
