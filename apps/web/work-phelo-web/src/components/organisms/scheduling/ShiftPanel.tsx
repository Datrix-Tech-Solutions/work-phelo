'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  day: number; // 1=Mon … 5=Fri (ISO weekday)
  date: string; // ISO date "YYYY-MM-DD"
}

interface ShiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeOptions: SearchSelectOption[];
  /** The day this shift belongs to (used when adding) */
  day?: number;
  date?: string;
  /** Populated when editing an existing shift */
  shift?: Shift | null;
  onSave: (data: Omit<Shift, 'id'>) => void;
}

/* ── Inner form — remounted via key whenever the panel target changes ── */

interface FormProps {
  isEditing: boolean;
  employeeOptions: SearchSelectOption[];
  initial: { employeeId: string; startTime: string; endTime: string };
  day: number;
  date: string;
  shift: Shift | null | undefined;
  onSave: (data: Omit<Shift, 'id'>) => void;
  onClose: () => void;
}

function ShiftForm({
  isEditing,
  employeeOptions,
  initial,
  day,
  date,
  shift,
  onSave,
  onClose,
}: FormProps) {
  const [employeeId, setEmployeeId] = useState(initial.employeeId);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [errors, setErrors] = useState<{ employee?: string; start?: string; end?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!employeeId) next.employee = 'Please select an employee';
    if (!startTime) next.start = 'Start time is required';
    if (!endTime) next.end = 'End time is required';
    if (startTime && endTime && startTime >= endTime)
      next.end = 'End time must be after start time';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const emp = employeeOptions.find((o) => o.value === employeeId);
    onSave({
      employeeId,
      employeeName: emp?.label ?? '',
      startTime,
      endTime,
      day: shift?.day ?? day,
      date: shift?.date ?? date,
    });
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={isEditing ? 'Edit Shift' : 'Add Shift'}
      description={
        isEditing ? 'Update the details for this shift.' : 'Assign a shift to an employee.'
      }
      footer={
        <Button className="w-full" onClick={handleSubmit}>
          {isEditing ? 'Save Changes' : 'Add Shift'}
        </Button>
      }
    >
      <SearchSelect
        label="Employee"
        placeholder="Search employee…"
        options={employeeOptions}
        value={employeeId}
        onChange={setEmployeeId}
        error={errors.employee}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Start Time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border rounded-input px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand border-gray-300"
        />
        {errors.start && <p className="text-xs text-red-500">{errors.start}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">End Time</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border rounded-input px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand border-gray-300"
        />
        {errors.end && <p className="text-xs text-red-500">{errors.end}</p>}
      </div>
    </SidePanel>
  );
}

/* ── Public wrapper — renders nothing when closed, remounts form on open ── */

export function ShiftPanel({
  isOpen,
  onClose,
  employeeOptions,
  day = 1,
  date = '',
  shift,
  onSave,
}: ShiftPanelProps) {
  if (!isOpen) {
    /* Render the panel in closed state so it can animate out */
    return (
      <SidePanel isOpen={false} onClose={onClose} title="">
        {null}
      </SidePanel>
    );
  }

  return (
    <ShiftForm
      key={shift?.id ?? `new-${date}`}
      isEditing={!!shift}
      employeeOptions={employeeOptions}
      initial={{
        employeeId: shift?.employeeId ?? '',
        startTime: shift?.startTime ?? '',
        endTime: shift?.endTime ?? '',
      }}
      day={day}
      date={date}
      shift={shift}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
