import {
  AppointmentNotifier,
  NotifiableAppointment,
} from './appointment-notifier.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const AMA = 'user-ama';
const KOFI = 'user-kofi';
const ABENA = 'user-abena';
const MANAGER = 'user-manager';

const appt = (
  overrides: Partial<NotifiableAppointment> = {},
): NotifiableAppointment => ({
  id: 'appt-1',
  tenantId: TENANT,
  prospectName: 'Accra Brewing Co.',
  date: new Date('2026-10-20T00:00:00.000Z'),
  startTime: '09:00',
  marketerUserId: AMA,
  marketerName: 'Ama Mensah',
  managerUserId: null,
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

describe('AppointmentNotifier', () => {
  const rabbit = {
    resolvePermissionRecipients: jest.fn(),
    inAppCreateMany: jest.fn(),
  };
  let notifier: AppointmentNotifier;

  const sent = () =>
    (rabbit.inAppCreateMany.mock.calls[0] as [Record<string, unknown>[]])[0];

  beforeEach(() => {
    jest.resetAllMocks();
    rabbit.resolvePermissionRecipients.mockResolvedValue([
      recipient(KOFI),
      recipient(ABENA),
      recipient(AMA),
    ]);
    rabbit.inAppCreateMany.mockResolvedValue(undefined);
    notifier = new AppointmentNotifier(rabbit as never);
  });

  describe('requested', () => {
    it('asks for everyone who can approve appointments, tenant admins included', async () => {
      await notifier.requested(appt(), AMA);

      expect(rabbit.resolvePermissionRecipients).toHaveBeenCalledWith({
        tenantId: TENANT,
        resource: 'marketing.appointments.all',
        action: 'APPROVE',
        includeTenantAdmins: true,
        activeOnly: true,
      });
    });

    it('notifies each approver except the person who booked it', async () => {
      await notifier.requested(appt(), AMA);

      const events = sent();
      expect(events.map((e) => e.recipientUserId)).toEqual([KOFI, ABENA]);
      expect(events[0]).toMatchObject({
        type: 'APPOINTMENT_REQUESTED',
        title: 'Appointment Awaiting Approval',
        link: '/marketing/appointments?appointmentId=appt-1',
        entityType: 'appointment',
        entityId: 'appt-1',
        sourceService: 'marketing-service',
      });
      expect(events[0].message).toContain('Ama Mensah');
      expect(events[0].message).toContain('Accra Brewing Co.');
      expect(events[0].message).toContain('20/10/2026');
    });

    it('tells the marketer once, with their own message, when someone else booked it', async () => {
      // Ama is also an approver here, so she must not get both messages.
      await notifier.requested(appt(), KOFI);

      expect(sent().map((e) => [e.recipientUserId, e.type])).toEqual([
        [ABENA, 'APPOINTMENT_REQUESTED'],
        [AMA, 'APPOINTMENT_BOOKED_FOR_YOU'],
      ]);
    });

    it('gives each notification a stable id so a redelivery cannot duplicate it', async () => {
      await notifier.requested(appt(), AMA);

      expect(sent()[0].eventId).toBe(
        `appointment:appt-1:APPOINTMENT_REQUESTED:${KOFI}`,
      );
    });

    it('never throws when the broker or lookup fails', async () => {
      rabbit.resolvePermissionRecipients.mockRejectedValue(new Error('down'));

      await expect(notifier.requested(appt(), AMA)).resolves.toBeUndefined();
      expect(rabbit.inAppCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('reviewed', () => {
    it('tells the marketer their appointment was approved', async () => {
      await notifier.reviewed(appt(), KOFI, 'APPROVED');

      expect(sent()).toEqual([
        expect.objectContaining({
          recipientUserId: AMA,
          type: 'APPOINTMENT_REVIEWED',
          title: 'Appointment Approved',
        }),
      ]);
    });

    it('marks a rejection as high priority', async () => {
      await notifier.reviewed(appt(), KOFI, 'REJECTED');

      expect(sent()[0]).toMatchObject({
        title: 'Appointment Rejected',
        priority: 'HIGH',
      });
    });

    it('also tells an assigned manager', async () => {
      await notifier.reviewed(
        appt({ managerUserId: MANAGER }),
        KOFI,
        'APPROVED',
      );

      expect(sent().map((e) => [e.recipientUserId, e.type])).toEqual([
        [AMA, 'APPOINTMENT_REVIEWED'],
        [MANAGER, 'APPOINTMENT_ASSIGNED'],
      ]);
    });

    it('does not notify someone about their own decision', async () => {
      await notifier.reviewed(
        appt({ marketerUserId: KOFI, managerUserId: KOFI }),
        KOFI,
        'APPROVED',
      );

      expect(rabbit.inAppCreateMany).toHaveBeenCalledWith([]);
    });

    it('does not tell a manager about a rejection', async () => {
      await notifier.reviewed(
        appt({ managerUserId: MANAGER }),
        KOFI,
        'REJECTED',
      );

      expect(sent().map((e) => e.recipientUserId)).toEqual([AMA]);
    });
  });
});
