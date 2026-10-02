'use client';

import { useMemo, useState } from 'react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import {
  AppointmentCard,
  Appointment,
  APPOINTMENT_STATUS_PILL,
} from '@/components/molecules/marketing/AppointmentCard';
import { AppointmentFilterBar } from '@/components/molecules/marketing/AppointmentFilterBar';
import {
  NewAppointmentForm,
  NewAppointmentFields,
  NewAppointmentErrors,
} from '@/components/molecules/marketing/NewAppointmentForm';
import { AppointmentsPanel } from '@/components/organisms/marketing/AppointmentsPanel';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useProspects } from '@/hooks/marketing/useProspects';
import { formatDate } from '@/lib/formatters';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

type MobileTab = 'appointments' | 'upcoming';

const MOBILE_TABS = [
  { key: 'appointments' as const, label: 'Appointments' },
  { key: 'upcoming' as const, label: 'Upcoming Appointments' },
];

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
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<NewAppointmentFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewAppointmentErrors>({});
  const [mobileTab, setMobileTab] = useState<MobileTab>('appointments');

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

  const filtered = appointments
    .filter((a) => a.prospectName.toLowerCase().includes(search.toLowerCase()))
    .filter((a) => !dateFilter || a.date === dateFilter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openNew() {
    setForm(EMPTY_FORM);
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
    <div className={cn(pageContent, 'flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto')}>
      <h1 className="text-xl font-bold text-gray-900 shrink-0">Appointments</h1>

      <TabBar
        tabs={MOBILE_TABS}
        activeTab={mobileTab}
        onTabChange={(t) => setMobileTab(t as MobileTab)}
        className="lg:hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={cn('lg:col-span-3', mobileTab !== 'appointments' && 'hidden lg:block')}>
          <DataCardGrid
            data={paginated}
            skeletonCount={6}
            searchPlaceholder="Search by prospect..."
            searchValue={search}
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            extraFilters={
              <AppointmentFilterBar
                dateFilter={dateFilter}
                onDateChange={(v) => {
                  setDateFilter(v);
                  setPage(1);
                }}
                showClear={!!dateFilter}
                onClear={() => {
                  setDateFilter('');
                  setPage(1);
                }}
              />
            }
            actionButton={{ label: 'New Appointment', onClick: openNew }}
            emptyMessage="No appointments found"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            renderCard={(appt) => (
              <AppointmentCard
                prospectName={appt.prospectName}
                date={formatDate(appt.date)}
                time={`${appt.startTime} – ${appt.endTime}`}
                manager={appt.manager}
                statusPill={APPOINTMENT_STATUS_PILL[appt.status]}
              />
            )}
          />
        </div>

        <div className={cn('lg:col-span-1', mobileTab !== 'upcoming' && 'hidden lg:block')}>
          <AppointmentsPanel appointments={appointments} />
        </div>
      </div>

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
