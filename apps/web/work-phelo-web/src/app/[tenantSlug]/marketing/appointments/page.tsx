'use client';

import { useMemo, useState } from 'react';
import { Appointment } from '@/components/molecules/marketing/AppointmentCard';
import {
  NewAppointmentForm,
  NewAppointmentFields,
  NewAppointmentErrors,
} from '@/components/molecules/marketing/NewAppointmentForm';
import { AppointmentsPanel } from '@/components/organisms/marketing/AppointmentsPanel';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useProspects } from '@/hooks/marketing/useProspects';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const EMPTY_FORM: NewAppointmentFields = {
  prospectId: '',
  date: '',
  startTime: '',
  endTime: '',
  manager: '',
  comment: '',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<NewAppointmentFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewAppointmentErrors>({});

  const [prospectSearch, setProspectSearch] = useState('');
  const { data: prospectsPage } = useProspects({
    limit: 100,
    search: prospectSearch || undefined,
  });
  const prospectOptions = useMemo(
    () => (prospectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.companyName })),
    [prospectsPage],
  );
  // Appointments are still local state, so keep the chosen prospect's name alongside its id.
  const [prospectLabels, setProspectLabels] = useState<Record<string, string>>({});

  function openNew(date?: string) {
    setForm({ ...EMPTY_FORM, date: date ?? '' });
    setErrors({});
    setProspectSearch('');
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  function validate(): boolean {
    const next: NewAppointmentErrors = {};
    if (!form.prospectId) next.prospectId = 'Prospect is required.';
    if (!form.date) next.date = 'Date is required.';
    if (!form.startTime) next.startTime = 'Start time is required.';
    if (!form.endTime) next.endTime = 'End time is required.';
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      next.endTime = 'End time must be after start time.';
    }
    if (!form.manager.trim()) next.manager = 'Manager is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setAppointments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        prospectName: prospectLabels[form.prospectId] ?? '',
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        manager: form.manager,
        comment: form.comment,
        status: 'scheduled',
      },
    ]);
    setPanelOpen(false);
  }

  return (
    <div className={cn(pageContent, 'flex flex-col gap-3 flex-1 min-h-0')}>
      <AppointmentsPanel appointments={appointments} onNew={openNew} />

      <SidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        title="New Appointment"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Appointment</Button>
          </div>
        }
      >
        <NewAppointmentForm
          values={form}
          onChange={(next) => {
            const label = prospectOptions.find((o) => o.value === next.prospectId)?.label;
            if (label) setProspectLabels((prev) => ({ ...prev, [next.prospectId]: label }));
            setForm(next);
          }}
          errors={errors}
          prospectOptions={prospectOptions}
          onProspectSearch={setProspectSearch}
        />
      </SidePanel>
    </div>
  );
}
