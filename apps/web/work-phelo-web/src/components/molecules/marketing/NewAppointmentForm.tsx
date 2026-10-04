'use client';

import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { inputClass } from '@/lib/utils';

export interface NewAppointmentFields {
  prospectId: string;
  date: string;
  startTime: string;
  endTime: string;
  marketerId: string;
  comment: string;
}

export type NewAppointmentErrors = Partial<Record<keyof NewAppointmentFields, string>>;

interface Props {
  values: NewAppointmentFields;
  onChange: (values: NewAppointmentFields) => void;
  errors?: NewAppointmentErrors;
  prospectOptions?: SearchSelectOption[];
  onProspectSearch?: (query: string) => void;
  marketerOptions?: SearchSelectOption[];
  /** False when the user can only book for themselves: the marketer is shown but locked. */
  canChooseMarketer?: boolean;
}

export function NewAppointmentForm({
  values,
  onChange,
  errors,
  prospectOptions = [],
  onProspectSearch,
  marketerOptions = [],
  canChooseMarketer = false,
}: Props) {
  function set<K extends keyof NewAppointmentFields>(key: K, val: string) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      <SearchSelect
        label="Marketer"
        placeholder="Select a marketer"
        options={marketerOptions}
        value={values.marketerId}
        // Prospects belong to a marketer, so a different marketer means a different list.
        onChange={(v) => onChange({ ...values, marketerId: v, prospectId: '' })}
        error={errors?.marketerId}
        disabled={!canChooseMarketer}
        clearable={false}
      />

      <SearchSelect
        label="Prospect Name"
        placeholder={values.marketerId ? 'Select a prospect' : 'Select a marketer first'}
        options={prospectOptions}
        value={values.prospectId}
        onChange={(v) => set('prospectId', v)}
        onQueryChange={onProspectSearch}
        error={errors?.prospectId}
      />

      <DatePicker
        label="Date"
        value={values.date}
        onChange={(v) => set('date', v)}
        error={errors?.date}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Start Time</label>
          <input
            type="time"
            value={values.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className={inputClass(errors?.startTime)}
          />
          {errors?.startTime && <p className="text-xs text-red-500">{errors.startTime}</p>}
        </div>
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">End Time (optional)</label>
          <input
            type="time"
            value={values.endTime}
            onChange={(e) => set('endTime', e.target.value)}
            className={inputClass(errors?.endTime)}
          />
          {errors?.endTime && <p className="text-xs text-red-500">{errors.endTime}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Comment</label>
        <textarea
          rows={4}
          placeholder="Additional notes for this appointment..."
          value={values.comment}
          onChange={(e) => set('comment', e.target.value)}
          className={inputClass(errors?.comment, 'resize-none')}
        />
        {errors?.comment && <p className="text-xs text-red-500">{errors.comment}</p>}
      </div>
    </div>
  );
}
