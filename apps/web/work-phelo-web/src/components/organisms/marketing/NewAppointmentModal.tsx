'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  NewAppointmentForm,
  NewAppointmentFields,
  NewAppointmentErrors,
} from '@/components/molecules/marketing/NewAppointmentForm';
import { useAppointmentFormOptions, useCreateAppointment } from '@/hooks/marketing/useAppointments';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useAuthStore } from '@/store/auth.store';

/** A prospect the appointment is fixed to, when it is booked from that prospect's own page. */
export interface AppointmentProspect {
  id: string;
  companyName: string;
  /** The marketer the prospect is assigned to. */
  assignedUserId: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Locks the prospect. Without it the prospect is chosen from the marketer's list. */
  prospect?: AppointmentProspect;
  /** Prefills the date (YYYY-MM-DD). */
  date?: string;
}

/** Mount only while open (or let `isOpen` gate it): the form resets each time it is shown. */
export function NewAppointmentModal({ isOpen, onClose, prospect, date }: Props) {
  if (!isOpen) return null;
  return <OpenModal onClose={onClose} prospect={prospect} date={date} />;
}

function OpenModal({ onClose, prospect, date }: Pick<Props, 'onClose' | 'prospect' | 'date'>) {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const createAppointment = useCreateAppointment();

  const [form, setForm] = useState<NewAppointmentFields>({
    prospectId: prospect?.id ?? '',
    date: date ?? '',
    startTime: '',
    endTime: '',
    marketerId: user?.id ?? '',
    comment: '',
  });
  const [errors, setErrors] = useState<NewAppointmentErrors>({});
  const [prospectSearch, setProspectSearch] = useState('');

  // Who can be the marketer, and that marketer's prospects — the server decides what this caller
  // may pick, so someone who can only book for themselves gets just themselves.
  const { data: options } = useAppointmentFormOptions({
    marketerUserId: form.marketerId || undefined,
    search: prospectSearch || undefined,
  });
  const marketerOptions = (options?.marketers ?? []).map((m) => ({ value: m.id, label: m.name }));
  const prospectOptions = prospect
    ? [{ value: prospect.id, label: prospect.companyName }]
    : (options?.prospects ?? []).map((p) => ({ value: p.id, label: p.name }));

  function validate(): boolean {
    const next: NewAppointmentErrors = {};
    if (!form.marketerId) next.marketerId = 'Marketer is required.';
    if (!form.prospectId) next.prospectId = 'Prospect is required.';
    if (!form.date) next.date = 'Date is required.';
    if (!form.startTime) next.startTime = 'Start time is required.';
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      next.endTime = 'End time must be after start time.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      await createAppointment.mutateAsync({
        prospectId: form.prospectId,
        date: form.date,
        startTime: form.startTime,
        ...(form.endTime ? { endTime: form.endTime } : {}),
        marketerUserId: form.marketerId,
        ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
      });
      toast.success('Appointment requested');
      onClose();
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New Appointment"
      width="max-w-lg"
      height="max-h-fit"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createAppointment.isPending}>
            Save Appointment
          </Button>
        </div>
      }
    >
      <NewAppointmentForm
        values={form}
        onChange={setForm}
        errors={errors}
        prospectOptions={prospectOptions}
        onProspectSearch={setProspectSearch}
        prospectLocked={!!prospect}
        marketerOptions={marketerOptions}
        canChooseMarketer={!!options?.canCreateForOthers}
      />
    </Modal>
  );
}
