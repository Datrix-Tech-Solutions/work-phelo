'use client';

import { useState } from 'react';
import { CalendarClock, ClipboardPlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { FollowUpForm, FollowUpFields } from '@/components/molecules/marketing/FollowUpForm';
import {
  useCancelFollowUp,
  useCreateFollowUp,
  useFollowUpWorklist,
  useProspectFollowUps,
  useUpdateFollowUp,
} from '@/hooks/marketing/useFollowUps';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { FollowUpStatus, FollowUpUrgency, ProspectFollowUp } from '@/types/marketing';

const DEFAULT_TIME = '09:00';
const URGENCY_LABEL: Record<FollowUpUrgency, string> = {
  OVERDUE: 'Overdue',
  UPCOMING: 'Upcoming',
  FUTURE: 'Later',
};
const STATUS: Record<FollowUpStatus, { label: string; color: TypeChipColor }> = {
  PENDING: { label: 'Pending', color: 'amber' },
  COMPLETED: { label: 'Completed', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(iso)}, ${time}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Local date (YYYY-MM-DD) and time (HH:mm) of an ISO timestamp, for the form inputs. */
function splitDueAt(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** The delay is a tenant setting, so it is read back from the dates rather than assumed. */
function automaticLabel(item: { dueAt: string; lastInteractionDate: string | null }) {
  if (!item.lastInteractionDate) return 'Automatic';
  const days = Math.round(
    (new Date(item.dueAt).getTime() - new Date(item.lastInteractionDate).getTime()) / 86_400_000,
  );
  return `Automatic (${days} ${days === 1 ? 'day' : 'days'} after last follow-up)`;
}

const COLUMNS: Column<ProspectFollowUp>[] = [
  {
    key: 'dueAt',
    label: 'Due',
    width: '190px',
    render: (row) => <span className="font-semibold">{formatDateTime(row.dueAt)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '140px',
    render: (row) => <TypeChip label={STATUS[row.status].label} color={STATUS[row.status].color} />,
  },
  {
    key: 'note',
    label: 'Note',
    width: 'minmax(160px, 1fr)',
    render: (row) => <span className="font-semibold">{row.note || '—'}</span>,
  },
  {
    key: 'completedAt',
    label: 'Completed On',
    width: '160px',
    render: (row) => <span className="font-semibold">{formatDate(row.completedAt)}</span>,
  },
  {
    key: 'createdAt',
    label: 'Scheduled On',
    width: '160px',
    render: (row) => <span className="font-semibold">{formatDate(row.createdAt)}</span>,
  },
];

interface Props {
  prospectId: string;
  companyName: string;
  primaryContact?: { name: string; phone: string | null; role?: string };
}

/** The prospect's reminders: the one coming up, with its actions, and the full history. */
export function ProspectRemindersTab({ prospectId, companyName, primaryContact }: Props) {
  const toast = useToast();
  const { data: history = [], isLoading } = useProspectFollowUps(prospectId);
  const { data: worklist = [] } = useFollowUpWorklist();
  const createFollowUp = useCreateFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const cancelFollowUp = useCancelFollowUp();

  // Each prospect has at most one reminder on the worklist: the next one due.
  const next = worklist.find((w) => w.prospectId === prospectId);

  const emptyForm: FollowUpFields = {
    prospectId,
    followUpDate: '',
    followUpTime: DEFAULT_TIME,
    notes: '',
  };
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpFields>(emptyForm);
  const [errors, setErrors] = useState<Partial<FollowUpFields>>({});
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  function openAdd() {
    setForm(emptyForm);
    setErrors({});
    setEditingFollowUpId(null);
    setPanelOpen(true);
  }

  function openReschedule() {
    if (!next) return;
    const { date, time } = splitDueAt(next.dueAt);
    setForm({ prospectId, followUpDate: date, followUpTime: time, notes: next.note ?? '' });
    setErrors({});
    // An automatic reminder has no record to edit, so saving schedules an explicit one instead.
    setEditingFollowUpId(next.followUpId);
    setPanelOpen(true);
  }

  function handleSave() {
    const nextErrors: Partial<FollowUpFields> = {};
    if (!form.followUpDate) nextErrors.followUpDate = 'Reminder date is required.';
    if (!form.followUpTime) nextErrors.followUpTime = 'Time is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const note = form.notes.trim();
    // Date and time are picked in local time; the API stores an ISO (UTC) timestamp.
    const dueAt = new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString();
    const onError = (error: unknown) =>
      toast.error(apiErrorMessage(error, 'Failed to save reminder'));
    const onSuccess = (message: string) => () => {
      toast.success(message);
      setPanelOpen(false);
    };

    if (editingFollowUpId) {
      updateFollowUp.mutate(
        { id: editingFollowUpId, payload: { dueAt, note } },
        { onSuccess: onSuccess('Reminder updated'), onError },
      );
    } else {
      createFollowUp.mutate(
        { prospectId, payload: { dueAt, ...(note ? { note } : {}) } },
        { onSuccess: onSuccess('Reminder scheduled'), onError },
      );
    }
  }

  function handleCancel() {
    if (!next?.followUpId) return;
    cancelFollowUp.mutate(next.followUpId, {
      onSuccess: () => {
        toast.success('Reminder cancelled');
        setCancelling(false);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to cancel reminder')),
    });
  }

  const isSaving = createFollowUp.isPending || updateFollowUp.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Next reminder</p>
          {next ? (
            <p className="text-sm text-gray-900 mt-0.5">
              <span className="font-semibold">
                {URGENCY_LABEL[next.urgency]}: {formatDateTime(next.dueAt)}
              </span>
              {next.followUpSource === 'DEFAULT' && (
                <span className="text-gray-500"> · {automaticLabel(next)}</span>
              )}
              {next.note && <span className="text-gray-500"> · {next.note}</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-0.5">No reminder scheduled</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Only once the reminder time has passed. */}
          {next?.urgency === 'OVERDUE' && (
            <TableButton
              variant="blue"
              onClick={() => setRecording(true)}
              className="inline-flex items-center gap-1.5"
            >
              <ClipboardPlus className="w-3.5 h-3.5" />
              Record Follow-up
            </TableButton>
          )}
          {/* Automatic reminders have no record to cancel or reschedule. */}
          {next?.followUpId &&
            (next.urgency === 'OVERDUE' ? (
              <TableButton
                variant="orange"
                onClick={openReschedule}
                className="inline-flex items-center gap-1.5"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Reschedule
              </TableButton>
            ) : (
              <TableButton
                variant="red"
                onClick={() => setCancelling(true)}
                className="inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </TableButton>
            ))}
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
            Add Reminder
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={history}
        emptyMessage="No reminders yet"
        isLoading={isLoading}
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <Modal
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editingFollowUpId ? 'Edit Reminder' : 'Add Reminder'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {editingFollowUpId ? 'Save Changes' : 'Add Reminder'}
            </Button>
          </div>
        }
      >
        <FollowUpForm
          values={form}
          onChange={setForm}
          errors={errors}
          prospectOptions={[{ value: prospectId, label: companyName }]}
          prospectLocked
        />
      </Modal>

      <AddInteractionPanel
        prospectId={prospectId}
        followUpId={next?.followUpId}
        isOpen={recording}
        onClose={() => setRecording(false)}
        primaryContact={primaryContact}
      />

      <Modal
        isOpen={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel Reminder"
        description="Are you sure you want to cancel this reminder? The prospect goes back to its automatic reminder date."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(false)}>
              Keep
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancelFollowUp.isPending}>
              Cancel Reminder
            </Button>
          </>
        }
      />
    </div>
  );
}
