'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FollowUpForm, FollowUpFields } from '@/components/molecules/marketing/FollowUpForm';
import { useCreateFollowUp } from '@/hooks/marketing/useFollowUps';
import { useProspects } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: FollowUpFields = {
  prospectId: '',
  followUpDate: '',
  followUpTime: '09:00',
  notes: '',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Schedules a reminder for any prospect, chosen in the form. */
export function AddReminderPanel({ isOpen, onClose }: Props) {
  const toast = useToast();
  const createFollowUp = useCreateFollowUp();
  const [form, setForm] = useState<FollowUpFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FollowUpFields>>({});

  const [prospectSearch, setProspectSearch] = useState('');
  const { data: prospectsPage } = useProspects({ limit: 100, search: prospectSearch || undefined });
  const prospectOptions = useMemo(
    () => (prospectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.companyName })),
    [prospectsPage],
  );

  function handleClose() {
    setForm(EMPTY_FORM);
    setErrors({});
    setProspectSearch('');
    onClose();
  }

  function handleSave() {
    const next: Partial<FollowUpFields> = {};
    if (!form.prospectId) next.prospectId = 'Prospect is required.';
    if (!form.followUpDate) next.followUpDate = 'Reminder date is required.';
    if (!form.followUpTime) next.followUpTime = 'Time is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const note = form.notes.trim();
    // Date and time are picked in local time; the API stores an ISO (UTC) timestamp.
    const dueAt = new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString();
    createFollowUp.mutate(
      { prospectId: form.prospectId, payload: { dueAt, ...(note ? { note } : {}) } },
      {
        onSuccess: () => {
          toast.success('Reminder scheduled');
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to schedule reminder')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Reminder"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createFollowUp.isPending}>
            Add Reminder
          </Button>
        </div>
      }
    >
      <FollowUpForm
        values={form}
        onChange={setForm}
        errors={errors}
        prospectOptions={prospectOptions}
        onProspectSearch={setProspectSearch}
      />
    </Modal>
  );
}
