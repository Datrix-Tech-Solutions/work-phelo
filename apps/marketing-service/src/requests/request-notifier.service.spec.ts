import {
  NotifiableTransportRequest,
  RequestNotifier,
} from './request-notifier.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const AMA = 'user-ama';
const KOJO = 'user-kojo';
const ABENA = 'user-abena';

const request = (
  overrides: Partial<NotifiableTransportRequest> = {},
): NotifiableTransportRequest => ({
  id: 'req-1',
  travelDate: '2026-10-20',
  departureTime: '08:00',
  returnTime: '17:00',
  destination: 'Kumasi',
  requester: { userId: AMA, name: 'Ama Mensah' },
  review: null,
  allocation: null,
  ...overrides,
});

const recipient = (userId: string) => ({
  userId,
  email: `${userId}@x.com`,
  firstName: userId,
  lastName: '',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
});

describe('RequestNotifier', () => {
  const rabbit = {
    resolvePermissionRecipients: jest.fn(),
    inAppCreate: jest.fn(),
    inAppCreateMany: jest.fn(),
  };
  let notifier: RequestNotifier;

  const sentMany = () =>
    (rabbit.inAppCreateMany.mock.calls[0] as [Record<string, unknown>[]])[0];
  const sentOne = () =>
    (rabbit.inAppCreate.mock.calls[0] as [Record<string, unknown>])[0];

  beforeEach(() => {
    jest.resetAllMocks();
    rabbit.resolvePermissionRecipients.mockResolvedValue([
      recipient(KOJO),
      recipient(ABENA),
      recipient(AMA),
    ]);
    rabbit.inAppCreate.mockResolvedValue(undefined);
    rabbit.inAppCreateMany.mockResolvedValue(undefined);
    notifier = new RequestNotifier(rabbit as never);
  });

  describe('requested', () => {
    it('asks for everyone who can approve transport requests, tenant admins included', async () => {
      await notifier.requested(TENANT, request());

      expect(rabbit.resolvePermissionRecipients).toHaveBeenCalledWith({
        tenantId: TENANT,
        resource: 'marketing.requests.all',
        action: 'APPROVE',
        includeTenantAdmins: true,
        activeOnly: true,
      });
    });

    it('notifies each approver except the requester, linking to the request', async () => {
      await notifier.requested(TENANT, request());

      const events = sentMany();
      expect(events.map((e) => e.recipientUserId)).toEqual([KOJO, ABENA]);
      expect(events[0]).toMatchObject({
        type: 'TRANSPORT_REQUESTED',
        title: 'Transport Request Awaiting Approval',
        link: '/marketing/requests/all-requests?requestId=req-1',
        entityType: 'transportRequest',
        entityId: 'req-1',
        sourceService: 'marketing-service',
      });
      expect(events[0].message).toContain('Ama Mensah');
      expect(events[0].message).toContain('Kumasi');
      expect(events[0].message).toContain('20/10/2026');
    });

    it('never throws when the broker or lookup fails', async () => {
      rabbit.resolvePermissionRecipients.mockRejectedValue(new Error('down'));

      await expect(
        notifier.requested(TENANT, request()),
      ).resolves.toBeUndefined();
      expect(rabbit.inAppCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('decisions', () => {
    it('tells the requester their trip was approved, with the vehicle and driver', async () => {
      await notifier.approved(
        TENANT,
        request({
          allocation: {
            vehicle: { name: 'Toyota Hilux' },
            driver: { name: 'Yaw Owusu' },
          },
        }),
        KOJO,
      );

      expect(sentOne()).toMatchObject({
        recipientUserId: AMA,
        type: 'TRANSPORT_APPROVED',
        link: '/marketing/requests/all-requests?requestId=req-1',
      });
      expect(sentOne().message).toContain('Toyota Hilux');
      expect(sentOne().message).toContain('Yaw Owusu');
    });

    it('tells the requester about a rejection, with the reason, linking to history', async () => {
      await notifier.rejected(
        TENANT,
        request({ review: { note: 'No vehicle free' } }),
        KOJO,
      );

      expect(sentOne()).toMatchObject({
        type: 'TRANSPORT_REJECTED',
        priority: 'HIGH',
        link: '/marketing/requests/request-history?requestId=req-1',
      });
      expect(sentOne().message).toContain('No vehicle free');
    });

    it('tells the requester a trip was rescheduled, with the new time', async () => {
      await notifier.rescheduled(
        TENANT,
        request({ travelDate: '2026-10-22', departureTime: '09:30' }),
        KOJO,
      );

      expect(sentOne().message).toContain('22/10/2026');
      expect(sentOne().message).toContain('09:30');
    });

    it('gives each reschedule its own id so a second one is not dropped as a duplicate', async () => {
      await notifier.rescheduled(TENANT, request(), KOJO);
      await notifier.rescheduled(
        TENANT,
        request({ travelDate: '2026-10-22' }),
        KOJO,
      );

      const ids = rabbit.inAppCreate.mock.calls.map(
        (c) => (c as [{ eventId: string }])[0].eventId,
      );
      expect(new Set(ids).size).toBe(2);
    });

    it('does not notify someone about their own action', async () => {
      await notifier.approved(TENANT, request(), AMA);
      await notifier.rejected(TENANT, request(), AMA);

      expect(rabbit.inAppCreate).not.toHaveBeenCalled();
    });
  });

  describe('cancelled', () => {
    it('tells the requester when an approver cancels their trip', async () => {
      await notifier.cancelled(TENANT, request(), KOJO);

      expect(sentOne()).toMatchObject({
        recipientUserId: AMA,
        type: 'TRANSPORT_CANCELLED',
        priority: 'HIGH',
      });
      expect(rabbit.resolvePermissionRecipients).not.toHaveBeenCalled();
    });

    it('tells the approvers when the requester cancels their own trip', async () => {
      await notifier.cancelled(TENANT, request(), AMA);

      expect(sentMany().map((e) => e.recipientUserId)).toEqual([KOJO, ABENA]);
      expect(rabbit.inAppCreate).not.toHaveBeenCalled();
    });
  });
});
