'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { type GroupSettings, type PayrollGroup } from '@/lib/payroll-groups';
import { PayrollGroupScheduleFields } from './PayrollGroupFields';

interface PayrollGroupScheduleModalProps {
  group: PayrollGroup;
  onClose: () => void;
  isSaving: boolean;
  /** Why the last save failed, from the server. */
  error: string | null;
  onSave: (schedule: Pick<GroupSettings, 'frequency' | 'payday' | 'reminder'>) => void;
}

/** Change a payroll group's payment frequency, payday and payday reminder. */
export function PayrollGroupScheduleModal({
  group,
  onClose,
  isSaving,
  error,
  onSave,
}: PayrollGroupScheduleModalProps) {
  const [settings, setSettings] = useState<GroupSettings>({
    frequency: group.frequency,
    payday: group.payday,
    reminder: group.reminder,
    memberIds: [],
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Manage reminders"
      description={`Payment frequency, payday and reminder for ${group.name}.`}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSaving}
            loadingText="Saving…"
            onClick={() =>
              onSave({
                frequency: settings.frequency,
                payday: settings.payday,
                reminder: settings.reminder,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <PayrollGroupScheduleFields settings={settings} onChange={setSettings} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
