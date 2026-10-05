import { Injectable, Logger } from '@nestjs/common';
import { InAppNotificationCreateEvent } from '@work-phelo/types';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { MarketingRabbitPublisher } from '../messaging/rabbitmq.publisher';

/** The bits of a transport request response a notification needs. */
export interface NotifiableTransportRequest {
  id: string;
  travelDate: string; // YYYY-MM-DD
  departureTime: string;
  /** Null when the trip has no planned return time. */
  returnTime: string | null;
  /** Empty when no destination was chosen. */
  destination: string;
  requester: { userId: string; name: string };
  review: { note: string | null } | null;
  allocation: {
    vehicle: { name: string | null };
    driver: { name: string | null };
  } | null;
}

const SOURCE = 'marketing-service';
const [APPROVE_RESOURCE, APPROVE_ACTION] =
  MarketingCrmSettingsPermission.REQUESTS_APPROVE_ALL.split(':');

const dayMonthYear = (iso: string) => iso.split('-').reverse().join('/');

/** " to Kumasi", or nothing when the request has no destination. */
const toPlace = (req: NotifiableTransportRequest) =>
  req.destination ? ` to ${req.destination}` : '';

/** "08:00–17:00", or just "08:00" when there is no return time. */
const timeRange = (req: NotifiableTransportRequest) =>
  req.returnTime ? `${req.departureTime}–${req.returnTime}` : req.departureTime;

/** Where a request lives in the UI: live ones in the active tab, finished ones in history. */
const ACTIVE_PATH = '/marketing/requests/all-requests';
const HISTORY_PATH = '/marketing/requests/request-history';

/**
 * In-app notifications for the transport request flow. Best-effort, like the appointment ones:
 * a broker or recipient lookup failure is logged and never fails the request that caused it.
 */
@Injectable()
export class RequestNotifier {
  private readonly logger = new Logger(RequestNotifier.name);

  constructor(private readonly rabbit: MarketingRabbitPublisher) {}

  /** A new request: tell everyone who can approve it. */
  async requested(tenantId: string, req: NotifiableTransportRequest) {
    await this.toApprovers(tenantId, req, req.requester.userId, 'requested', {
      type: 'TRANSPORT_REQUESTED',
      title: 'Transport Request Awaiting Approval',
      message: `${req.requester.name} requested transport${toPlace(req)} on ${dayMonthYear(req.travelDate)}, ${timeRange(req)}.`,
      path: ACTIVE_PATH,
    });
  }

  /** An approver approved it. */
  async approved(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
  ) {
    const vehicle = req.allocation?.vehicle.name;
    const driver = req.allocation?.driver.name;
    const allocated = [vehicle, driver && `driver ${driver}`]
      .filter(Boolean)
      .join(', ');
    await this.toRequester(tenantId, req, actorUserId, 'approved', {
      type: 'TRANSPORT_APPROVED',
      title: 'Transport Request Approved',
      message: `Your trip${toPlace(req)} on ${dayMonthYear(req.travelDate)} was approved${allocated ? `: ${allocated}` : ''}.`,
      path: ACTIVE_PATH,
    });
  }

  async rejected(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
  ) {
    const note = req.review?.note;
    await this.toRequester(tenantId, req, actorUserId, 'rejected', {
      type: 'TRANSPORT_REJECTED',
      title: 'Transport Request Rejected',
      message: `Your trip${toPlace(req)} on ${dayMonthYear(req.travelDate)} was rejected${note ? `: ${note}` : '.'}`,
      priority: 'HIGH',
      path: HISTORY_PATH,
    });
  }

  async rescheduled(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
  ) {
    await this.toRequester(tenantId, req, actorUserId, 'rescheduled', {
      type: 'TRANSPORT_RESCHEDULED',
      title: 'Trip Rescheduled',
      message: `Your trip${toPlace(req)} was moved to ${dayMonthYear(req.travelDate)}, ${timeRange(req)}.`,
      priority: 'HIGH',
      path: ACTIVE_PATH,
    });
  }

  /** Cancelled by an approver: tell the requester. Cancelled by the requester: tell the approvers. */
  async cancelled(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
  ) {
    if (actorUserId === req.requester.userId) {
      await this.toApprovers(tenantId, req, actorUserId, 'cancelled', {
        type: 'TRANSPORT_CANCELLED',
        title: 'Transport Request Cancelled',
        message: `${req.requester.name} cancelled their trip${toPlace(req)} on ${dayMonthYear(req.travelDate)}.`,
        path: HISTORY_PATH,
      });
      return;
    }
    await this.toRequester(tenantId, req, actorUserId, 'cancelled', {
      type: 'TRANSPORT_CANCELLED',
      title: 'Transport Request Cancelled',
      message: `Your trip${toPlace(req)} on ${dayMonthYear(req.travelDate)} was cancelled.`,
      priority: 'HIGH',
      path: HISTORY_PATH,
    });
  }

  // --- plumbing ------------------------------------------------------------

  private async toRequester(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
    what: string,
    content: Content,
  ) {
    // Nobody needs telling about something they just did themselves.
    if (req.requester.userId === actorUserId) return;
    await this.safely(what, () =>
      this.rabbit.inAppCreate(
        this.event(tenantId, req, req.requester.userId, content),
      ),
    );
  }

  private async toApprovers(
    tenantId: string,
    req: NotifiableTransportRequest,
    actorUserId: string,
    what: string,
    content: Content,
  ) {
    await this.safely(what, async () => {
      const approvers = await this.rabbit.resolvePermissionRecipients({
        tenantId,
        resource: APPROVE_RESOURCE,
        action: APPROVE_ACTION,
        // Tenant admins can approve without holding the permission explicitly.
        includeTenantAdmins: true,
        activeOnly: true,
      });
      await this.rabbit.inAppCreateMany(
        approvers
          .filter((r) => r.userId !== actorUserId)
          .map((r) => this.event(tenantId, req, r.userId, content)),
      );
    });
  }

  private event(
    tenantId: string,
    req: NotifiableTransportRequest,
    recipientUserId: string,
    { type, title, message, priority, path }: Content,
  ): InAppNotificationCreateEvent {
    return {
      // Stable per request, event and person, so a redelivery can't double up. A reschedule can
      // happen more than once, so the schedule is part of its id.
      eventId: `transport:${req.id}:${type}:${recipientUserId}${type === 'TRANSPORT_RESCHEDULED' ? `:${req.travelDate}:${req.departureTime}` : ''}`,
      tenantId,
      recipientUserId,
      type,
      title,
      message,
      priority,
      link: `${path}?requestId=${encodeURIComponent(req.id)}`,
      entityType: 'transportRequest',
      entityId: req.id,
      sourceService: SOURCE,
    };
  }

  private async safely(what: string, action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      this.logger.error(
        `Failed to send transport request ${what} notification`,
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
    }
  }
}

interface Content {
  type: string;
  title: string;
  message: string;
  priority?: InAppNotificationCreateEvent['priority'];
  path: string;
}
