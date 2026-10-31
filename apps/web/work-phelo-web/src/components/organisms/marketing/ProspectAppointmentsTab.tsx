'use client';

import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { AppointmentDayList } from '@/components/molecules/marketing/AppointmentDayList';
import { NewAppointmentModal } from '@/components/organisms/marketing/NewAppointmentModal';
import { AppointmentDetailModal } from '@/components/organisms/marketing/AppointmentDetailModal';
import { useAppointments } from '@/hooks/marketing/useAppointments';
import { APPOINTMENT_STATUS_BADGES } from '@/lib/appointments';
import { cardClass, inputClass } from '@/lib/utils';
import type { Appointment, AppointmentStatus } from '@/types/marketing';

const STATUS_OPTIONS = Object.entries(APPOINTMENT_STATUS_BADGES).map(([value, { label }]) => ({
  value,
  label,
}));

interface Props {
  /** The prospect the appointments are for; for a client, the prospect it was converted from. */
  prospectId: string;
  companyName: string;
  /** The marketer the prospect is assigned to. */
  assignedUserId: string;
  /** Whether the viewer may book here. */
  canCreate?: boolean;
}

/** A prospect's (or client's) appointments, with a form to book another. */
export function ProspectAppointmentsTab({
  prospectId,
  companyName,
  assignedUserId,
  canCreate = true,
}: Props) {
  const { data: appointments = [], isLoading } = useAppointments({ prospectId });

  const [bookingOpen, setBookingOpen] = useState(false);
  const [viewing, setViewing] = useState<Appointment | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const query = search.trim().toLowerCase();
  const visible = appointments.filter(
    (a) =>
      (!statusFilter || a.status === (statusFilter as AppointmentStatus)) &&
      (!query ||
        [a.marketerName, a.managerName, a.comment].some((v) => v?.toLowerCase().includes(query))),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass('px-4 py-1 shrink-0')}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass(undefined, 'pl-9 pr-4 py-1.5')}
            />
          </div>
          <SearchSelect
            size="sm"
            placeholder="Status"
            allLabel="All statuses"
            options={STATUS_OPTIONS}
            value={statusFilter}
            showAllOption
            onChange={setStatusFilter}
          />
          <div className="flex-1" />
          {canCreate && (
            <Button size="sm" onClick={() => setBookingOpen(true)}>
              New Appointment
            </Button>
          )}
        </div>
      </div>

      <AppointmentDayList
        hideHeading
        emptyMessage={
          appointments.length > 0 ? 'No appointments match your filters' : 'No appointments yet'
        }
        appointments={visible}
        isLoading={isLoading}
        onSelect={setViewing}
      />

      <AppointmentDetailModal
        key={viewing?.id ?? 'none'}
        appointment={viewing}
        onClose={() => setViewing(null)}
      />

      <NewAppointmentModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        prospect={{ id: prospectId, companyName, assignedUserId }}
      />
    </div>
  );
}
