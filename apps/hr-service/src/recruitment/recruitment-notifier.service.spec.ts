import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RecruitmentNotifier } from './recruitment-notifier.service';

describe('RecruitmentNotifier', () => {
  let rabbitmq: {
    notificationRecruitmentApplicationReceived: jest.Mock<any>;
    notificationRecruitmentInterviewScheduled: jest.Mock<any>;
    authResolvePermissionRecipients: jest.Mock<any>;
  };
  let notifications: { createMany: jest.Mock<any> };
  let notifier: RecruitmentNotifier;

  const received = {
    tenantId: 'tenant-1',
    applicationId: 'application-1',
    email: 'ama@example.com',
    firstName: 'Ama',
    lastName: 'Mensah',
    vacancyTitle: 'Accountant',
    companyName: 'Acme Ltd',
  };

  beforeEach(() => {
    rabbitmq = {
      notificationRecruitmentApplicationReceived: jest.fn(),
      notificationRecruitmentInterviewScheduled: jest.fn(),
      authResolvePermissionRecipients: jest.fn(),
    };
    rabbitmq.notificationRecruitmentApplicationReceived.mockResolvedValue(
      undefined,
    );
    rabbitmq.notificationRecruitmentInterviewScheduled.mockResolvedValue(
      undefined,
    );
    rabbitmq.authResolvePermissionRecipients.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    notifications = { createMany: jest.fn() };
    notifications.createMany.mockResolvedValue({ count: 2 });
    notifier = new RecruitmentNotifier(rabbitmq as any, notifications as any);
  });

  describe('applicationReceived', () => {
    it('emails the applicant and alerts everyone who can view candidates', async () => {
      await notifier.applicationReceived(received);

      expect(
        rabbitmq.notificationRecruitmentApplicationReceived,
      ).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        applicationId: 'application-1',
        candidateEmail: 'ama@example.com',
        candidateFirstName: 'Ama',
        vacancyTitle: 'Accountant',
        companyName: 'Acme Ltd',
      });
      expect(rabbitmq.authResolvePermissionRecipients).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          resource: 'recruitment.candidates',
          action: 'VIEW',
          includeTenantAdmins: true,
          activeOnly: true,
        }),
      );
      const alerts = notifications.createMany.mock.calls[0][0] as any[];
      expect(alerts.map((alert) => alert.userId)).toEqual(['user-1', 'user-2']);
      expect(alerts[0]).toEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'RECRUITMENT_APPLICATION_RECEIVED',
          message: 'Ama Mensah applied for Accountant.',
          link: '/hr/recruitment/candidates/application-1',
          entityId: 'application-1',
        }),
      );
    });

    it('skips the email when the applicant left no address, but still alerts recruiters', async () => {
      await notifier.applicationReceived({ ...received, email: null });

      expect(
        rabbitmq.notificationRecruitmentApplicationReceived,
      ).not.toHaveBeenCalled();
      expect(notifications.createMany).toHaveBeenCalledTimes(1);
    });

    it('sends no alert when nobody can view candidates', async () => {
      rabbitmq.authResolvePermissionRecipients.mockResolvedValue([]);
      await notifier.applicationReceived(received);
      expect(notifications.createMany).not.toHaveBeenCalled();
    });

    it('never throws: a failed email does not stop the recruiter alert', async () => {
      rabbitmq.notificationRecruitmentApplicationReceived.mockRejectedValue(
        new Error('broker down'),
      );
      await expect(
        notifier.applicationReceived(received),
      ).resolves.toBeUndefined();
      expect(notifications.createMany).toHaveBeenCalledTimes(1);
    });

    it('never throws when the recipients lookup fails', async () => {
      rabbitmq.authResolvePermissionRecipients.mockRejectedValue(
        new Error('auth down'),
      );
      await expect(
        notifier.applicationReceived(received),
      ).resolves.toBeUndefined();
      expect(
        rabbitmq.notificationRecruitmentApplicationReceived,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('interviewScheduled', () => {
    const interview = {
      tenantId: 'tenant-1',
      applicationId: 'application-1',
      interviewId: 'interview-1',
      email: 'ama@example.com',
      firstName: 'Ama',
      vacancyTitle: 'Accountant',
      companyName: 'Acme Ltd',
      scheduledAt: new Date('2099-01-01T10:00:00Z'),
      durationMinutes: 45,
      mode: 'VIDEO' as const,
      platform: 'Google Meet',
      meetingLink: 'https://meet.google.com/abc',
      phone: null,
      location: null,
    };

    it('emails the candidate with the time and how to join', async () => {
      await notifier.interviewScheduled(interview);

      expect(
        rabbitmq.notificationRecruitmentInterviewScheduled,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateEmail: 'ama@example.com',
          scheduledAt: '2099-01-01T10:00:00.000Z',
          timeZone: 'Africa/Accra',
          mode: 'VIDEO',
          platform: 'Google Meet',
          meetingLink: 'https://meet.google.com/abc',
          phone: undefined,
          location: undefined,
        }),
      );
    });

    it('does nothing when the candidate left no address', async () => {
      await notifier.interviewScheduled({ ...interview, email: null });
      expect(
        rabbitmq.notificationRecruitmentInterviewScheduled,
      ).not.toHaveBeenCalled();
    });

    it('never throws when publishing fails', async () => {
      rabbitmq.notificationRecruitmentInterviewScheduled.mockRejectedValue(
        new Error('broker down'),
      );
      await expect(
        notifier.interviewScheduled(interview),
      ).resolves.toBeUndefined();
    });
  });
});
