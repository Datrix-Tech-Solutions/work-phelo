'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  NewAppointmentForm,
  NewAppointmentFields,
  NewAppointmentErrors,
} from '@/components/molecules/marketing/NewAppointmentForm';
import { AppointmentDetailPanel } from '@/components/organisms/marketing/AppointmentDetailPanel';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { RequestPanel } from '@/components/organisms/marketing/RequestPanel';
import { AppointmentsPanel } from '@/components/organisms/marketing/AppointmentsPanel';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  useAppointment,
  useAppointmentFormOptions,
  useCreateAppointment,
} from '@/hooks/marketing/useAppointments';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { Appointment } from '@/types/marketing';

const EMPTY_FORM: NewAppointmentFields = {
  prospectId: '',
  date: '',
  startTime: '',
  endTime: '',
  marketerId: '',
  comment: '',
};

export default function AppointmentsPage() {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();
  const [viewing, setViewing] = useState<Appointment | null>(null);

  // A notification links here with ?appointmentId=…, which opens that appointment's details.
  const linkedId = useSearchParams().get('appointmentId');
  const { data: linked } = useAppointment(linkedId ?? undefined);
  const detail = viewing ?? linked ?? null;

  function closeDetail() {
    setViewing(null);
    if (linkedId) router.replace(pathname);
  }

  // The appointment a vehicle is being requested for; the request form is open while this is set.
  const [transportFor, setTransportFor] = useState<Appointment | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Appointment | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<NewAppointmentFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewAppointmentErrors>({});
  const [prospectSearch, setProspectSearch] = useState('');

  // Who can be the marketer, and that marketer's prospects — the server decides what this caller
  // may pick, so someone who can only book for themselves gets just themselves.
  const { data: options } = useAppointmentFormOptions(
    { marketerUserId: form.marketerId || undefined, search: prospectSearch || undefined },
    panelOpen,
  );
  const marketerOptions = (options?.marketers ?? []).map((m) => ({ value: m.id, label: m.name }));
  const prospectOptions = (options?.prospects ?? []).map((p) => ({ value: p.id, label: p.name }));

  const createAppointment = useCreateAppointment();

  function openNew(date?: string) {
    setForm({ ...EMPTY_FORM, date: date ?? '', marketerId: user?.id ?? '' });
    setErrors({});
    setProspectSearch('');
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

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
      setPanelOpen(false);
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  return (
    <div className={cn(pageContent, 'flex flex-col gap-3 flex-1 min-h-0')}>
      <AppointmentsPanel onNew={openNew} onSelectAppointment={setViewing} />

      <AppointmentDetailPanel
        key={detail?.id ?? 'none'}
        appointment={detail}
        onClose={closeDetail}
        onRequestTransport={(appointment) => {
          closeDetail();
          setTransportFor(appointment);
        }}
        onCompleted={(appointment) => {
          if (appointment.prospectId) setFollowUpFor(appointment);
        }}
      />

      <AddInteractionPanel
        prospectId={followUpFor?.prospectId ?? undefined}
        isOpen={!!followUpFor}
        onClose={() => setFollowUpFor(null)}
      />

      <RequestPanel
        isOpen={!!transportFor}
        appointment={transportFor}
        onClose={() => setTransportFor(null)}
      />

      <SidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        title="New Appointment"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closePanel}>
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
          marketerOptions={marketerOptions}
          canChooseMarketer={!!options?.canCreateForOthers}
        />
      </SidePanel>
    </div>
  );
}
