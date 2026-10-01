'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ClipboardPlus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { DetailField } from '@/components/atoms/DetailField';
import { FollowUpForm, FollowUpFields } from '@/components/molecules/marketing/FollowUpForm';
import {
  useCancelFollowUp,
  useCreateFollowUp,
  useDueFollowUps,
  useFollowUpWorklist,
  useUpdateFollowUp,
} from '@/hooks/marketing/useFollowUps';
import { useProspect, useProspects } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { FollowUpUrgency, FollowUpWorklistItem } from '@/types/marketing';

const DEFAULT_TIME = '09:00';
const EMPTY_FORM: FollowUpFields = {
  prospectId: '',
  followUpDate: '',
  followUpTime: DEFAULT_TIME,
  notes: '',
};
const URGENCY_LABEL: Record<FollowUpUrgency, string> = {
  OVERDUE: 'Overdue',
  UPCOMING: 'Upcoming',
  FUTURE: 'Later',
};
type PanelMode = 'add' | 'edit';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
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

export default function UpcomingFollowUpsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: worklist = [], isLoading } = useFollowUpWorklist();
  const createFollowUp = useCreateFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const cancelFollowUp = useCancelFollowUp();
  const { data: dueFollowUps } = useDueFollowUps();

  // The prospect being recorded against; its contacts prefill the interaction form.
  const [recordingProspectId, setRecordingProspectId] = useState<string | null>(null);
  const { data: recordingProspect } = useProspect(recordingProspectId ?? '');
  const recordingContact =
    recordingProspect?.contacts.find((c) => c.isPrimary) ?? recordingProspect?.contacts[0];

  // The reminder covers what is due when the tab is opened. Follow-ups that fall due while the
  // page is already open get the tab badge and the row button, not another popup.
  const [reminderIds, setReminderIds] = useState<string[] | null>(null);
  if (reminderIds === null && !isLoading) {
    setReminderIds(dueFollowUps.map((item) => item.prospectId));
  }
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const reminderItems = dueFollowUps.filter((item) => reminderIds?.includes(item.prospectId));
  const dueModalOpen = !reminderDismissed && reminderItems.length > 0;

  const [prospectSearch, setProspectSearch] = useState('');
  const { data: prospectsPage } = useProspects({ limit: 100, search: prospectSearch || undefined });
  // The worklist's prospects are included so a locked selection always has a label.
  const prospectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const w of worklist) byId.set(w.prospectId, w.companyName);
    for (const p of prospectsPage?.data ?? []) byId.set(p.id, p.companyName);
    return [...byId].map(([value, label]) => ({ value, label }));
  }, [worklist, prospectsPage]);

  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FollowUpFields>>({});
  // Editing never changes the prospect, so its picker is read-only.
  const [prospectLocked, setProspectLocked] = useState(false);
  const [viewingProspectId, setViewingProspectId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  // Rows are keyed by prospect: each prospect has at most one follow-up on the worklist.
  const byProspect = useMemo(
    () => new Map<string, FollowUpWorklistItem>(worklist.map((w) => [w.prospectId, w])),
    [worklist],
  );

  const items: CardListItem[] = useMemo(
    () =>
      worklist
        .filter((w) => w.companyName.toLowerCase().includes(search.toLowerCase()))
        .map((w) => ({
          id: w.prospectId,
          label: w.companyName,
          sublabel: [
            `${URGENCY_LABEL[w.urgency]}: ${formatDateTime(w.dueAt)}`,
            w.followUpSource === 'DEFAULT' ? 'Automatic (7 days after last interaction)' : null,
            w.note,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    [worklist, search],
  );

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('add');
    setEditingFollowUpId(null);
    setProspectLocked(false);
    setPanelOpen(true);
  }

  function openEdit(prospectId: string) {
    const item = byProspect.get(prospectId);
    if (!item) return;
    const { date, time } = splitDueAt(item.dueAt);
    setForm({ prospectId, followUpDate: date, followUpTime: time, notes: item.note ?? '' });
    setErrors({});
    // An automatic follow-up has no record to edit, so saving schedules an explicit one instead.
    setPanelMode(item.followUpId ? 'edit' : 'add');
    setEditingFollowUpId(item.followUpId);
    setProspectLocked(true);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<FollowUpFields> = {};
    if (!form.prospectId) next.prospectId = 'Prospect is required.';
    if (!form.followUpDate) next.followUpDate = 'Follow-up date is required.';
    if (!form.followUpTime) next.followUpTime = 'Time is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const note = form.notes.trim();
    // Date and time are picked in local time; the API stores an ISO (UTC) timestamp.
    const dueAt = new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString();
    const onError = (error: unknown) =>
      toast.error(apiErrorMessage(error, 'Failed to save follow up'));
    const onSuccess = (message: string) => () => {
      toast.success(message);
      setPanelOpen(false);
    };

    if (editingFollowUpId) {
      updateFollowUp.mutate(
        { id: editingFollowUpId, payload: { dueAt, note } },
        { onSuccess: onSuccess('Follow up updated'), onError },
      );
    } else {
      createFollowUp.mutate(
        {
          prospectId: form.prospectId,
          payload: { dueAt, ...(note ? { note } : {}) },
        },
        { onSuccess: onSuccess('Follow up scheduled'), onError },
      );
    }
  }

  function requestCancel(prospectId: string) {
    const followUpId = byProspect.get(prospectId)?.followUpId;
    if (followUpId) setCancelId(followUpId);
  }

  function handleCancel() {
    if (!cancelId) return;
    cancelFollowUp.mutate(cancelId, {
      onSuccess: () => {
        toast.success('Reminder cancelled');
        setCancelId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to cancel reminder')),
    });
  }

  const viewing = viewingProspectId ? byProspect.get(viewingProspectId) : undefined;
  const isSaving = createFollowUp.isPending || updateFollowUp.isPending;

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <CardList
          addLabel="Add Reminder"
          items={isLoading ? [] : items}
          onAdd={openAdd}
          onView={setViewingProspectId}
          renderExtraActions={(id) => {
            const item = byProspect.get(id);
            if (!item) return null;
            return (
              <>
                {/* Only once the follow-up time has passed. */}
                {item.urgency === 'OVERDUE' && (
                  <TableButton
                    variant="blue"
                    onClick={() => setRecordingProspectId(id)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <ClipboardPlus className="w-3.5 h-3.5" />
                    Record Reminder
                  </TableButton>
                )}
                {/* Automatic follow-ups have no record to cancel or reschedule. */}
                {item.followUpId &&
                  (item.urgency === 'OVERDUE' ? (
                    <TableButton
                      variant="orange"
                      onClick={() => openEdit(id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      Reschedule
                    </TableButton>
                  ) : (
                    <TableButton
                      variant="red"
                      onClick={() => requestCancel(id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </TableButton>
                  ))}
              </>
            );
          }}
          searchValue={search}
          onSearchChange={setSearch}
        />
      </div>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Follow Up' : 'Edit Follow Up'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {panelMode === 'add' ? 'Add Follow Up' : 'Save Changes'}
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
          prospectLocked={prospectLocked}
        />
      </SidePanel>

      <SidePanel
        isOpen={!!viewing}
        onClose={() => setViewingProspectId(null)}
        title="Follow Up Details"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setViewingProspectId(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                viewing &&
                router.push(`/${tenantSlug}/marketing/prospects/all/${viewing.prospectId}`)
              }
            >
              View Prospect
            </Button>
            <Button
              onClick={() => {
                const id = viewingProspectId;
                setViewingProspectId(null);
                if (id) openEdit(id);
              }}
            >
              Edit
            </Button>
          </div>
        }
      >
        {viewing && (
          <div className="flex flex-col gap-5">
            <DetailField label="Prospect" value={viewing.companyName} />
            <DetailField label="Due" value={formatDateTime(viewing.dueAt)} />
            <DetailField label="Status" value={URGENCY_LABEL[viewing.urgency]} />
            <DetailField
              label="Type"
              value={
                viewing.followUpSource === 'DEFAULT'
                  ? 'Automatic (7 days after last interaction)'
                  : 'Scheduled'
              }
            />
            <DetailField
              label="Notes"
              value={
                viewing.note ? <span className="whitespace-pre-wrap">{viewing.note}</span> : null
              }
            />
            <DetailField
              label="Last Interaction"
              value={
                viewing.lastInteractionDate ? formatDateTime(viewing.lastInteractionDate) : null
              }
            />
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={dueModalOpen}
        onClose={() => setReminderDismissed(true)}
        title="Follow Ups Due"
        description={`${reminderItems.length} follow up${reminderItems.length === 1 ? ' is' : 's are'} due. Record an interaction once you've followed up.`}
        width="max-w-lg"
        footer={
          <Button variant="outline" onClick={() => setReminderDismissed(true)}>
            Later
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {reminderItems.map((item) => (
            <div
              key={item.prospectId}
              className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.companyName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[formatDateTime(item.dueAt), item.note].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setReminderDismissed(true);
                  setRecordingProspectId(item.prospectId);
                }}
              >
                Record Interaction
              </Button>
            </div>
          ))}
        </div>
      </Modal>

      <AddInteractionPanel
        prospectId={recordingProspectId ?? ''}
        followUpId={recordingProspectId ? byProspect.get(recordingProspectId)?.followUpId : null}
        isOpen={!!recordingProspectId}
        onClose={() => setRecordingProspectId(null)}
        primaryContact={
          recordingContact && {
            name: recordingContact.name,
            phone: recordingContact.phone,
            role: recordingContact.decisionMaker?.name,
          }
        }
      />

      <Modal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel Follow Up"
        description="Are you sure you want to cancel this follow up? The prospect goes back to its automatic follow-up date."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancelFollowUp.isPending}>
              Cancel Follow Up
            </Button>
          </>
        }
      />
    </>
  );
}
