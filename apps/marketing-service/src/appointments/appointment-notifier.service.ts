import { Injectable, Logger } from '@nestjs/common';
import { InAppNotificationCreateEvent } from '@work-phelo/types';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { MarketingRabbitPublisher } from '../messaging/rabbitmq.publisher';

/** The bits of an appointment a notification needs. */
export interface NotifiableAppointment {
  id: string;
  tenantId: string;
  prospectName: string;
  date: Date;
  startTime: string;
  marketerUserId: string;
  marketerName: string;
  managerUserId: string | null;
}

const SOURCE = 'marketing-service';
/** Appointment APPROVE lives on marketing.appointments.all; resolved as resource + action. */
const [APPROVE_RESOURCE, APPROVE_ACTION] =
  MarketingCrmSettingsPermission.APPOINTMENTS_APPROVE_ALL.split(':');

const dayMonthYear = (date: Date) => {
  const [y, m, d] = date.toISOString().slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/**
 * In-app notifications for the appointment flow. Always best-effort: a broker or recipient
 * lookup failure is logged and never fails the request that triggered it.
 */
@Injectable()
export class AppointmentNotifier {
  private readonly logger = new Logger(AppointmentNotifier.name);

  constructor(private readonly rabbit: MarketingRabbitPublisher) {}

  /** A new appointment: tell everyone who can approve it, and the marketer if booked for them. */
  async requested(appt: NotifiableAppointment, actorUserId: string) {
    await this.safely('requested', async () => {
      const approvers = await this.rabbit.resolvePermissionRecipients({
        tenantId: appt.tenantId,
        resource: APPROVE_RESOURCE,
        action: APPROVE_ACTION,
        // Tenant admins can approve without holding the permission explicitly.
        includeTenantAdmins: true,
        activeOnly: true,
      });

      // Booked for someone else: the marketer gets their own message below, so they are left out
      // here even when they can approve.
      const bookedForOther = appt.marketerUserId !== actorUserId;
      const events: InAppNotificationCreateEvent[] = approvers
        .filter(
          (r) =>
            r.userId !== actorUserId &&
            !(bookedForOther && r.userId === appt.marketerUserId),
        )
        .map((r) =>
          this.event(appt, r.userId, 'APPOINTMENT_REQUESTED', {
            title: 'Appointment Awaiting Approval',
            message: `${appt.marketerName} requested an appointment with ${appt.prospectName} on ${dayMonthYear(appt.date)} at ${appt.startTime}.`,
            priority: 'NORMAL',
          }),
        );

      if (bookedForOther) {
        events.push(
          this.event(appt, appt.marketerUserId, 'APPOINTMENT_BOOKED_FOR_YOU', {
            title: 'Appointment Booked For You',
            message: `An appointment with ${appt.prospectName} on ${dayMonthYear(appt.date)} at ${appt.startTime} was booked for you and is awaiting approval.`,
          }),
        );
      }

      await this.rabbit.inAppCreateMany(events);
    });
  }

  /** A decision: tell the marketer, and the manager if one was assigned. */
  async reviewed(
    appt: NotifiableAppointment,
    actorUserId: string,
    outcome: 'APPROVED' | 'REJECTED',
  ) {
    await this.safely('reviewed', async () => {
      const when = `${dayMonthYear(appt.date)} at ${appt.startTime}`;
      const events: InAppNotificationCreateEvent[] = [];

      if (appt.marketerUserId !== actorUserId) {
        events.push(
          this.event(appt, appt.marketerUserId, 'APPOINTMENT_REVIEWED', {
            title:
              outcome === 'APPROVED'
                ? 'Appointment Approved'
                : 'Appointment Rejected',
            message: `Your appointment with ${appt.prospectName} on ${when} was ${outcome === 'APPROVED' ? 'approved' : 'rejected'}.`,
            priority: outcome === 'REJECTED' ? 'HIGH' : 'NORMAL',
          }),
        );
      }

      if (
        outcome === 'APPROVED' &&
        appt.managerUserId &&
        appt.managerUserId !== actorUserId &&
        appt.managerUserId !== appt.marketerUserId
      ) {
        events.push(
          this.event(appt, appt.managerUserId, 'APPOINTMENT_ASSIGNED', {
            title: 'Appointment Assigned To You',
            message: `You are the manager for ${appt.marketerName}'s appointment with ${appt.prospectName} on ${when}.`,
          }),
        );
      }

      await this.rabbit.inAppCreateMany(events);
    });
  }

  private event(
    appt: NotifiableAppointment,
    recipientUserId: string,
    type: string,
    content: Pick<
      InAppNotificationCreateEvent,
      'title' | 'message' | 'priority'
    >,
  ): InAppNotificationCreateEvent {
    return {
      // Stable per appointment, event and person, so a redelivery can't double up.
      eventId: `appointment:${appt.id}:${type}:${recipientUserId}`,
      tenantId: appt.tenantId,
      recipientUserId,
      type,
      ...content,
      link: `/marketing/appointments?appointmentId=${encodeURIComponent(appt.id)}`,
      entityType: 'appointment',
      entityId: appt.id,
      sourceService: SOURCE,
    };
  }

  private async safely(what: string, action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      this.logger.error(
        `Failed to send appointment ${what} notification`,
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
    }
  }
}
