'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { formatDate } from '@/lib/formatters';
import {
  Appointment,
  APPOINTMENT_STATUS_PILL,
  formatAppointmentTime,
} from '@/components/molecules/marketing/AppointmentCard';

interface Props {
  appointment: Appointment | null;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

export function AppointmentDetailPanel({ appointment, onClose }: Props) {
  return (
    <SidePanel isOpen={!!appointment} onClose={onClose} title="Appointment Details">
      {appointment && (
        <dl className="flex flex-col gap-4">
          <Field label="Prospect">{appointment.prospectName}</Field>
          <Field label="Date">{formatDate(appointment.date)}</Field>
          <Field label="Time">{formatAppointmentTime(appointment)}</Field>
          <Field label="Status">{APPOINTMENT_STATUS_PILL[appointment.status].label}</Field>
          <Field label="Marketer">{appointment.marketer || '—'}</Field>
          <Field label="Manager">{appointment.manager || 'Not assigned'}</Field>
          <Field label="Comment">{appointment.comment || '—'}</Field>
        </dl>
      )}
    </SidePanel>
  );
}
