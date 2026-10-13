'use client';

import { DatePicker } from '@/components/atoms/DatePicker';
import { inputClass } from '@/lib/utils';
import type { DriverLicenceDetails } from '@/types/hr';

export const emptyLicenceDetails = (): DriverLicenceDetails => ({
  licenceNumber: '',
  issuedAt: '',
  expiresAt: '',
});

const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** What is wrong with the details, or null when they can be saved. */
export function licenceDetailsError(details: DriverLicenceDetails): string | null {
  if (details.licenceNumber.trim().length < 3) return "Enter the licence's ID number.";
  if (!details.issuedAt) return 'Enter the date of issue.';
  if (!details.expiresAt) return 'Enter the date of expiry.';
  if (details.issuedAt > todayIso()) return 'The issue date cannot be in the future.';
  if (details.expiresAt <= details.issuedAt) return 'The expiry date must be after the issue date.';
  return null;
}

interface Props {
  value: DriverLicenceDetails;
  onChange: (next: DriverLicenceDetails) => void;
}

/** The three details a driver's licence needs: its ID number, date of issue and date of expiry. */
export function DriverLicenceFields({ value, onChange }: Props) {
  const set = <K extends keyof DriverLicenceDetails>(key: K, next: DriverLicenceDetails[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Licence ID number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={value.licenceNumber}
          onChange={(e) => set('licenceNumber', e.target.value)}
          placeholder="e.g. DL-0012345"
          maxLength={50}
          className={inputClass()}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          label="Date of issue *"
          value={value.issuedAt}
          onChange={(v) => set('issuedAt', v)}
          maxDate={todayIso()}
        />
        <DatePicker
          label="Date of expiry *"
          value={value.expiresAt}
          onChange={(v) => set('expiresAt', v)}
        />
      </div>
    </div>
  );
}
