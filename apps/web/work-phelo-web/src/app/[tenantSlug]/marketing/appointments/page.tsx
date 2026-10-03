'use client';

import { useMemo, useState } from 'react';
import { Appointment } from '@/components/molecules/marketing/AppointmentCard';
import {
  NewAppointmentForm,
  NewAppointmentFields,
  NewAppointmentErrors,
} from '@/components/molecules/marketing/NewAppointmentForm';
import { AppointmentDetailPanel } from '@/components/organisms/marketing/AppointmentDetailPanel';
import { AppointmentsPanel } from '@/components/organisms/marketing/AppointmentsPanel';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { useMarketingModuleUsers } from '@/hooks/marketing/useMarketingModuleUsers';
import { useProspects } from '@/hooks/marketing/useProspects';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const EMPTY_FORM: NewAppointmentFields = {
  prospectId: '',
  date: '',
  startTime: '',
  endTime: '',
  marketerId: '',
  manager: '',
  comment: '',
};

// TODO: remove — temporary dummy data (dates relative to today) to preview the layout.
function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
}

const DUMMY_APPOINTMENTS: Appointment[] = [
  ['Accra Brewing Co.', -6, '09:00', '10:00', 'Ama Mensah', 'completed', 'Nana Addo'],
  ['Volta Logistics', -2, '14:00', '15:00', 'Kofi Boateng', 'completed', 'Nana Addo'],
  ['Golden Tulip Hotels', 0, '10:00', '11:00', 'Ama Mensah', 'scheduled', 'Nana Addo'],
  ['Kumasi Textiles', 0, '13:30', '14:30', 'Yaw Owusu', 'scheduled', ''],
  ['Takoradi Marine', 1, '09:30', '10:30', 'Kofi Boateng', 'scheduled', 'Abena Sarpong'],
  ['Cape Coast Foods', 3, '11:00', '12:00', 'Efua Asare', 'scheduled', ''],
  ['Tema Steel Works', 3, '15:00', '16:00', 'Yaw Owusu', 'scheduled', ''],
  ['Sunyani Agro', 5, '08:30', '', 'Ama Mensah', 'cancelled', 'Abena Sarpong'],
  ['Ho Pharma Ltd', 8, '10:00', '11:30', 'Efua Asare', 'scheduled', ''],
  ['Tamale Energy', 12, '14:00', '15:00', 'Kofi Boateng', 'scheduled', ''],
].map(([prospectName, offset, startTime, endTime, marketer, status, manager], i) => ({
  id: `dummy-${i}`,
  prospectName: prospectName as string,
  date: daysFromToday(offset as number),
  startTime: startTime as string,
  endTime: (endTime as string) || undefined,
  marketer: marketer as string,
  manager: (manager as string) || undefined,
  comment: '',
  status: status as Appointment['status'],
}));

export default function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const [appointments, setAppointments] = useState<Appointment[]>(DUMMY_APPOINTMENTS);

  const [viewing, setViewing] = useState<Appointment | null>(null);
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
  // Marketers and managers are picked from the people with marketing module access.
  const { users: moduleUsers } = useMarketingModuleUsers();
  const userOptions = useMemo(
    () => moduleUsers.map((u) => ({ value: u.id, label: u.name })),
    [moduleUsers],
  );
  // Appointments are still local state, so keep the chosen prospect's name alongside its id.
  const [prospectLabels, setProspectLabels] = useState<Record<string, string>>({});

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
    if (!form.prospectId) next.prospectId = 'Prospect is required.';
    if (!form.date) next.date = 'Date is required.';
    if (!form.startTime) next.startTime = 'Start time is required.';
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      next.endTime = 'End time must be after start time.';
    }
    if (!form.marketerId) next.marketerId = 'Marketer is required.';
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
        endTime: form.endTime || undefined,
        marketer: userOptions.find((o) => o.value === form.marketerId)?.label ?? '',
        manager: userOptions.find((o) => o.value === form.manager)?.label,
        comment: form.comment,
        status: 'scheduled',
      },
    ]);
    setPanelOpen(false);
  }

  return (
    <div className={cn(pageContent, 'flex flex-col gap-3 flex-1 min-h-0')}>
      <AppointmentsPanel
        appointments={appointments}
        onNew={openNew}
        onSelectAppointment={setViewing}
      />

      <AppointmentDetailPanel appointment={viewing} onClose={() => setViewing(null)} />

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
          marketerOptions={userOptions}
          managerOptions={userOptions}
          onProspectSearch={setProspectSearch}
        />
      </SidePanel>
    </div>
  );
}
