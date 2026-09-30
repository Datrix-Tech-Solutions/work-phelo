'use client';

import { inputClass } from '@/lib/utils';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';

export interface FollowUpFields {
  /** The selected prospect's ID. */
  prospectId: string;
  followUpDate: string;
  followUpTime: string;
  notes: string;
}

interface Props {
  values: FollowUpFields;
  onChange: (values: FollowUpFields) => void;
  errors?: Partial<FollowUpFields>;
  prospectOptions?: SearchSelectOption[];
  onProspectSearch?: (query: string) => void;
  /** A follow-up can't move to another prospect once it exists. */
  prospectLocked?: boolean;
}

export function FollowUpForm({
  values,
  onChange,
  errors,
  prospectOptions = [],
  onProspectSearch,
  prospectLocked = false,
}: Props) {
  function set<K extends keyof FollowUpFields>(key: K, val: string) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      <SearchSelect
        label="Prospect Name"
        placeholder="Select a prospect"
        options={prospectOptions}
        value={values.prospectId}
        onChange={(v) => set('prospectId', v)}
        onQueryChange={onProspectSearch}
        error={errors?.prospectId}
        disabled={prospectLocked}
      />

      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label="Follow-up Date"
          value={values.followUpDate}
          onChange={(v) => set('followUpDate', v)}
          error={errors?.followUpDate}
        />
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Time</label>
          <input
            type="time"
            value={values.followUpTime}
            onChange={(e) => set('followUpTime', e.target.value)}
            className={inputClass(errors?.followUpTime)}
          />
          {errors?.followUpTime && <p className="text-xs text-red-500">{errors.followUpTime}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
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
