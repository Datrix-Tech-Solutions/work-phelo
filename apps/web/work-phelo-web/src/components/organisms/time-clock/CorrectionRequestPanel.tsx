'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useSubmitCorrectionRequest } from '@/hooks/useTimeClock';
import { useToast } from '@/hooks/useToast';

interface CorrectionRequestPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CorrectionRequestPanel({ isOpen, onClose }: CorrectionRequestPanelProps) {
  const toast = useToast();
  const { mutate, isPending } = useSubmitCorrectionRequest();

  const [date, setDate] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ date?: string; reason?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!date) e.date = 'Date is required';
    if (!reason.trim()) e.reason = 'Reason is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutate(
      {
        date,
        requestedClockIn: clockIn || undefined,
        requestedClockOut: clockOut || undefined,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Correction request submitted');
          setDate('');
          setClockIn('');
          setClockOut('');
          setReason('');
          setErrors({});
          onClose();
        },
        onError: (err) => {
          const msg =
            (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Failed to submit request';
          toast.error(msg);
        },
      },
    );
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Report Missed Entry"
      description="Request a correction for a missed or incorrect clock entry. An admin will review your request."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending} loadingText="Submitting…">
            Submit Request
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <DatePicker
            label="Date of Missed Entry"
            value={date}
            onChange={(v) => {
              setDate(v);
              if (errors.date) setErrors((e) => ({ ...e, date: undefined }));
            }}
          />
          {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
        </div>

        {/* Times row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Expected Clock In <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Expected Clock Out <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* Reason */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) setErrors((e2) => ({ ...e2, reason: undefined }));
            }}
            rows={4}
            placeholder="Explain why the correction is needed…"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
          {errors.reason && <p className="text-xs text-red-500">{errors.reason}</p>}
        </div>

        {/* Info note */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-input">
          <p className="text-xs text-blue-700 leading-relaxed">
            Correction requests are reviewed by HR. Approved corrections will update your attendance
            record. You&apos;ll be notified once reviewed.
          </p>
        </div>
      </div>
    </SidePanel>
  );
}
