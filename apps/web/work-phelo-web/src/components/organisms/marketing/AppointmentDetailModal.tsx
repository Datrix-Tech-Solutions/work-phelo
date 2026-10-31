'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import { APPOINTMENT_STATUS_BADGES, formatAppointmentTime } from '@/lib/appointments';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import {
  useAppointmentFormOptions,
  useApproveAppointment,
  useCancelAppointment,
  useCompleteAppointment,
  useRejectAppointment,
} from '@/hooks/marketing/useAppointments';
import { useAuthStore } from '@/store/auth.store';
import type { Appointment } from '@/types/marketing';

const APPROVE_PERMISSION = 'marketing.appointments.all:APPROVE';

interface Props {
  appointment: Appointment | null;
  onClose: () => void;
  /** Opens the transport request form for an approved appointment. */
  onRequestTransport?: (appointment: Appointment) => void;
  /** Called after the appointment is marked completed, so the caller can open the follow-up form. */
  onCompleted?: (appointment: Appointment) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

function Section({
  title,
  columns = 2,
  children,
}: {
  title: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h4>
      <dl
        className={columns === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'flex flex-col gap-3'}
      >
        {children}
      </dl>
    </section>
  );
}

/** Mount with `key={appointment.id}` so the manager choice resets between appointments. */
export function AppointmentDetailModal({
  appointment,
  onClose,
  onRequestTransport,
  onCompleted,
}: Props) {
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id);
  const canApprove = usePermissionRule(APPROVE_PERMISSION);
  const [managerId, setManagerId] = useState('');

  const pending = appointment?.status === 'PENDING';
  const { data: options } = useAppointmentFormOptions({}, !!appointment && canApprove && pending);
  const managerOptions = (options?.managers ?? []).map((m) => ({ value: m.id, label: m.name }));

  const approve = useApproveAppointment();
  const reject = useRejectAppointment();
  const cancel = useCancelAppointment();
  const complete = useCompleteAppointment();
  const busy = approve.isPending || reject.isPending || cancel.isPending || complete.isPending;

  const isOwn = !!appointment && appointment.marketerUserId === userId;
  const isManager = !!appointment && appointment.managerUserId === userId;
  const live = appointment?.status === 'PENDING' || appointment?.status === 'APPROVED';
  const canCancel = live && (isOwn || canApprove);
  const canComplete = appointment?.status === 'APPROVED' && (isOwn || isManager || canApprove);

  async function run(action: () => Promise<unknown>, done: string, after?: () => void) {
    try {
      await action();
      toast.success(done);
      onClose();
      after?.();
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  // Only an approved appointment with a prospect can have a vehicle requested for it.
  const canRequestTransport =
    !!onRequestTransport &&
    appointment?.status === 'APPROVED' &&
    !!appointment.prospectId &&
    (isOwn || isManager || canApprove);

  const hasActions = (canApprove && pending) || canCancel || canComplete || canRequestTransport;

  return (
    <Modal
      isOpen={!!appointment}
      onClose={onClose}
      title="Appointment Details"
      width="max-w-lg"
      height="max-h-fit"
      footer={
        appointment && hasActions ? (
          <div className="flex items-center justify-end gap-3 flex-wrap">
            {canCancel && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(() => cancel.mutateAsync(appointment.id), 'Appointment cancelled')
                }
              >
                Cancel Appointment
              </Button>
            )}
            {canApprove && pending && (
              <>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    run(() => reject.mutateAsync({ id: appointment.id }), 'Appointment rejected')
                  }
                >
                  Reject
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        approve.mutateAsync({
                          id: appointment.id,
                          ...(managerId ? { managerUserId: managerId } : {}),
                        }),
                      'Appointment approved',
                    )
                  }
                >
                  Approve
                </Button>
              </>
            )}
            {canRequestTransport && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onRequestTransport(appointment)}
              >
                Request Transport
              </Button>
            )}
            {canComplete && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () => complete.mutateAsync(appointment.id),
                    'Appointment marked completed',
                    () => onCompleted?.(appointment),
                  )
                }
              >
                Mark Completed
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {appointment && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-bold text-gray-900">{appointment.prospectName}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label={APPOINTMENT_STATUS_BADGES[appointment.status].label}
                variant={APPOINTMENT_STATUS_BADGES[appointment.status].variant}
              />
              {appointment.salesStage && (
                <Badge
                  label={`${appointment.salesStage.name} (${appointment.salesStage.probability}%)`}
                  variant="neutral"
                />
              )}
            </div>
          </div>

          <Section title="Schedule">
            <Field label="Date">{formatDate(appointment.date)}</Field>
            <Field label="Time">{formatAppointmentTime(appointment)}</Field>
          </Section>

          <Section title="People">
            <Field label="Marketer">{appointment.marketerName}</Field>
            {canApprove && pending ? (
              <SearchSelect
                label="Assign a manager (optional)"
                placeholder="Select a manager"
                options={managerOptions}
                value={managerId}
                onChange={setManagerId}
              />
            ) : (
              <Field label="Manager">{appointment.managerName ?? 'Not assigned'}</Field>
            )}
          </Section>

          <Section title="Notes" columns={1}>
            <Field label="Comment">{appointment.comment || '—'}</Field>
          </Section>

          {appointment.reviewedByName && (
            <Section title="Review" columns={1}>
              <Field label="Reviewed by">{appointment.reviewedByName}</Field>
              {appointment.reviewNote && <Field label="Note">{appointment.reviewNote}</Field>}
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
