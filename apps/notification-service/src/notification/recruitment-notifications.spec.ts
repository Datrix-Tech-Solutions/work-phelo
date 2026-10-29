import { NotificationService } from './notification.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('recruitment emails', () => {
  const prisma = {
    notificationLog: { findFirst: jest.fn(), create: jest.fn() },
  };
  const sms = {};
  let email: EmailService;
  let sent: { to: string; subject: string; html: string }[];
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    process.env.FRONTEND_BASE_URL = 'https://app.example.com';
    prisma.notificationLog.findFirst.mockResolvedValue(null);
    prisma.notificationLog.create.mockResolvedValue({});
    email = new EmailService();
    sent = [];
    jest
      .spyOn(
        email as unknown as {
          send: (to: string, subject: string, html: string) => Promise<boolean>;
        },
        'send',
      )
      .mockImplementation((to, subject, html) => {
        sent.push({ to, subject, html });
        return Promise.resolve(true);
      });
    service = new NotificationService(
      prisma as unknown as PrismaService,
      email,
      sms as unknown as SmsService,
    );
  });

  const received = {
    tenantId: 'tenant-1',
    applicationId: 'application-1',
    candidateEmail: 'ama@example.com',
    candidateFirstName: 'Ama',
    vacancyTitle: 'Accountant',
    companyName: 'Acme Ltd',
  };

  const interview = {
    tenantId: 'tenant-1',
    applicationId: 'application-1',
    interviewId: 'interview-1',
    candidateEmail: 'ama@example.com',
    candidateFirstName: 'Ama',
    vacancyTitle: 'Accountant',
    companyName: 'Acme Ltd',
    scheduledAt: '2099-01-01T10:00:00.000Z',
    durationMinutes: 45,
    timeZone: 'Africa/Accra',
    mode: 'VIDEO' as const,
    platform: 'Google Meet',
    meetingLink: 'https://meet.google.com/abc-defg',
  };

  it('confirms the application to the applicant and logs it against the application', async () => {
    await service.sendRecruitmentApplicationReceived(received);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ama@example.com');
    expect(sent[0].subject).toBe('We received your application for Accountant');
    expect(sent[0].html).toContain('Accountant');
    expect(sent[0].html).toContain('Acme Ltd');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RECRUITMENT_APPLICATION_RECEIVED',
        status: 'SENT',
        recipient: 'ama@example.com',
        metadata: { applicationId: 'application-1' },
      }) as Record<string, unknown>,
    });
  });

  it('does not send the confirmation twice for one application', async () => {
    prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1' });
    await service.sendRecruitmentApplicationReceived(received);
    expect(sent).toHaveLength(0);
    expect(prisma.notificationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          metadata: { path: ['applicationId'], equals: 'application-1' },
        }) as Record<string, unknown>,
      }),
    );
  });

  it('escapes what the applicant typed', async () => {
    await service.sendRecruitmentApplicationReceived({
      ...received,
      candidateFirstName: '<script>alert(1)</script>',
    });
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain('&lt;script&gt;');
  });

  it('sends a video interview with the time in the given zone and the join link', async () => {
    await service.sendRecruitmentInterviewScheduled(interview);

    expect(sent[0].subject).toBe('Interview scheduled — Accountant');
    expect(sent[0].html).toContain('Thursday, 1 January 2099 at 10:00 GMT');
    expect(sent[0].html).toContain('10:00');
    expect(sent[0].html).toContain('GMT');
    expect(sent[0].html).toContain('45 minutes');
    expect(sent[0].html).toContain('Google Meet');
    expect(sent[0].html).toContain('https://meet.google.com/abc-defg');
  });

  it('shows the phone number for a phone interview and the place for an in-person one', async () => {
    await service.sendRecruitmentInterviewScheduled({
      ...interview,
      interviewId: 'interview-2',
      mode: 'PHONE',
      phone: '+233201234567',
    });
    expect(sent[0].html).toContain('Phone call');
    expect(sent[0].html).toContain('+233201234567');

    await service.sendRecruitmentInterviewScheduled({
      ...interview,
      interviewId: 'interview-3',
      mode: 'IN_PERSON',
      location: 'Head Office, 2nd floor',
    });
    expect(sent[1].html).toContain('In person');
    expect(sent[1].html).toContain('Head Office, 2nd floor');
  });

  it('leaves out a join link that is not http or https', async () => {
    await service.sendRecruitmentInterviewScheduled({
      ...interview,
      meetingLink: 'javascript:alert(1)',
    });
    expect(sent[0].html).not.toContain('javascript:');
    expect(sent[0].html).not.toContain('Join link');
  });

  it('does not send the interview mail twice for one interview', async () => {
    prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1' });
    await service.sendRecruitmentInterviewScheduled(interview);
    expect(sent).toHaveLength(0);
  });

  it('logs a failed send', async () => {
    (email as unknown as { send: jest.Mock }).send.mockImplementation(() =>
      Promise.resolve(false),
    );
    await service.sendRecruitmentInterviewScheduled(interview);
    expect(prisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RECRUITMENT_INTERVIEW_SCHEDULED',
        status: 'FAILED',
      }) as Record<string, unknown>,
    });
  });
});
