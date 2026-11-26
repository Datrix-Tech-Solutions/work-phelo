'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { todayLocal } from '@/lib/utils';

interface Props {
  mode: 'add' | 'set';
  /** For "set": the time the person has logged now. */
  currentMs?: number;
  isOpen: boolean;
  onClose: () => void;
  /** `date` is the day the time was worked, YYYY-MM-DD. */
  onSubmit: (ms: number, date: string) => void;
}

/** Enter time by hand: add time that was worked, or correct the total already logged. */
export function TimeEntryModal({ mode, currentMs = 0, isOpen, onClose, onSubmit }: Props) {
  const currentMinutes = Math.floor(currentMs / 60000);
  const [hours, setHours] = useState(mode === 'set' ? Math.floor(currentMinutes / 60) : 0);
  const [minutes, setMinutes] = useState(mode === 'set' ? currentMinutes % 60 : 0);
  const [date, setDate] = useState(todayLocal);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (minutes > 59) return setError('Minutes must be 59 or less');
    const ms = (hours * 60 + minutes) * 60000;
    if (mode === 'add' && ms <= 0) return setError('Enter the time that was worked');
    if (!date) return setError('Pick the day the time was worked');
    onSubmit(ms, date);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? 'Add Time' : 'Edit My Time'}
      description={
        mode === 'add'
          ? 'Time you worked on this task without the timer. It is added to your time.'
          : 'Set the total time you have spent on this task.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{mode === 'add' ? 'Add Time' : 'Save'}</Button>
        </>
      }
    >
      <div className="mt-4 grid grid-cols-2 gap-4">
        <NumberField
          label="Hours"
          decimals={0}
          value={hours}
          onChange={setHours}
          className="w-full py-2"
        />
        <NumberField
          label="Minutes"
          decimals={0}
          value={minutes}
          onChange={setMinutes}
          className="w-full py-2"
        />
      </div>
      <div className="mt-3">
        <DatePicker label="Date Worked" value={date} onChange={setDate} />
        {mode === 'set' && (
          <p className="mt-1 text-xs text-gray-400">
            The difference from your current total is recorded on this day.
          </p>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </Modal>
  );
}
