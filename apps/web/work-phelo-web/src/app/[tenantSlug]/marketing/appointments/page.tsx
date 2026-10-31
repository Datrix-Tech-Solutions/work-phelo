'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NewAppointmentModal } from '@/components/organisms/marketing/NewAppointmentModal';
import { AppointmentDetailModal } from '@/components/organisms/marketing/AppointmentDetailModal';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { RequestPanel } from '@/components/organisms/marketing/RequestPanel';
import { AppointmentsPanel } from '@/components/organisms/marketing/AppointmentsPanel';
import { useAppointment } from '@/hooks/marketing/useAppointments';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types/marketing';

export default function AppointmentsPage() {
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

  // The day picked on the calendar, which prefills the booking form; the form is open while set.
  const [booking, setBooking] = useState<{ date: string } | null>(null);

  return (
    <div className={cn(pageContent, 'flex flex-col gap-3 flex-1 min-h-0')}>
      <AppointmentsPanel
        onNew={(date) => setBooking({ date: date ?? '' })}
        onSelectAppointment={setViewing}
      />

      <AppointmentDetailModal
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

      <NewAppointmentModal
        isOpen={!!booking}
        onClose={() => setBooking(null)}
        date={booking?.date || undefined}
      />
    </div>
  );
}
