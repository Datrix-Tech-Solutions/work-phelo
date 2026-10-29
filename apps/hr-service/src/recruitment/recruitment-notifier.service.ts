import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';

/** Interview times in the mail are shown in this zone; the zone name is printed beside them. */
export const RECRUITMENT_MAIL_TIME_ZONE = 'Africa/Accra';

export interface ApplicationReceivedInput {
  tenantId: string;
  applicationId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  vacancyTitle: string | null;
  companyName: string | null;
}

export interface InterviewScheduledInput {
  tenantId: string;
  applicationId: string;
  interviewId: string;
  email: string | null;
  firstName: string | null;
  vacancyTitle: string | null;
  companyName: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  mode: 'VIDEO' | 'PHONE' | 'IN_PERSON';
  platform: string | null;
  meetingLink: string | null;
  phone: string | null;
  location: string | null;
}

/**
 * Tells people about recruitment events: the applicant and candidate by email, recruiters in the
 * app. Nothing here may fail the request that triggered it, so every send is caught and logged.
 */
@Injectable()
export class RecruitmentNotifier {
  private readonly logger = new Logger(RecruitmentNotifier.name);

  constructor(
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly notifications: NotificationsService,
  ) {}

  async applicationReceived(input: ApplicationReceivedInput) {
    await this.safely('application received email', async () => {
      if (!input.email) return;
      await this.rabbitmq.notificationRecruitmentApplicationReceived({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        candidateEmail: input.email,
        candidateFirstName: input.firstName ?? '',
        vacancyTitle: input.vacancyTitle,
        companyName: input.companyName,
      });
    });

    await this.safely('new application alert', async () => {
      const recruiters = await this.rabbitmq.authResolvePermissionRecipients({
        tenantId: input.tenantId,
        resource: 'recruitment.candidates',
        action: 'VIEW',
        includeTenantAdmins: true,
        activeOnly: true,
      });
      if (recruiters.length === 0) return;
      const applicant =
        [input.firstName, input.lastName].filter(Boolean).join(' ') ||
        'A candidate';
      await this.notifications.createMany(
        recruiters.map((recruiter) => ({
          tenantId: input.tenantId,
          userId: recruiter.userId,
          type: 'RECRUITMENT_APPLICATION_RECEIVED',
          title: 'New application',
          message: `${applicant} applied${
            input.vacancyTitle ? ` for ${input.vacancyTitle}` : ''
          }.`,
          link: `/hr/recruitment/candidates/${encodeURIComponent(input.applicationId)}`,
          entityType: 'recruitmentApplication',
          entityId: input.applicationId,
        })),
      );
    });
  }

  async interviewScheduled(input: InterviewScheduledInput) {
    await this.safely('interview scheduled email', async () => {
      if (!input.email) return;
      await this.rabbitmq.notificationRecruitmentInterviewScheduled({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        interviewId: input.interviewId,
        candidateEmail: input.email,
        candidateFirstName: input.firstName ?? '',
        vacancyTitle: input.vacancyTitle,
        companyName: input.companyName,
        scheduledAt: input.scheduledAt.toISOString(),
        durationMinutes: input.durationMinutes,
        timeZone: RECRUITMENT_MAIL_TIME_ZONE,
        mode: input.mode,
        platform: input.platform ?? undefined,
        meetingLink: input.meetingLink ?? undefined,
        phone: input.phone ?? undefined,
        location: input.location ?? undefined,
      });
    });
  }

  private async safely(what: string, send: () => Promise<void>) {
    try {
      await send();
    } catch (error) {
      this.logger.error(
        `Failed to send ${what}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
