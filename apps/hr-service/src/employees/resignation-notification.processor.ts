import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';

export const RESIGNATION_QUEUE = 'resignation';
export const RESIGNATION_NOTIFY_JOB = 'notify-admin';

export interface ResignationNotifyPayload {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  lastWorkingDate: string;
  reason?: string;
  additionalNotes?: string;
  detailLink: string;
  adminEmail: string | null;
  adminUserId: string | null;
}

@Processor(RESIGNATION_QUEUE)
export class ResignationNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ResignationNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ResignationNotifyPayload>): Promise<void> {
    const { tenantId, employeeId, adminEmail, adminUserId, ...rest } = job.data;

    const resignation = await this.prisma.resignationRecord.findUnique({
      where: { employeeId },
    });

    // Employee may have withdrawn within the 30-minute window — skip silently
    if (!resignation || resignation.status !== 'PENDING') {
      this.logger.log(
        `Skipping resignation notification for employee ${employeeId} — status is ${resignation?.status ?? 'not found'}`,
      );
      return;
    }

    if (adminUserId) {
      await this.notificationsService.create({
        tenantId,
        userId: adminUserId,
        type: 'RESIGNATION_SUBMITTED',
        message: `${rest.employeeFirstName} ${rest.employeeLastName} submitted a resignation effective ${new Date(rest.lastWorkingDate).toLocaleDateString('en-GB')}${rest.reason ? ` (${rest.reason})` : ''}.`,
        link: rest.detailLink,
      });
    }

    if (adminEmail) {
      void this.rabbitmq
        .notificationResignationSubmitted({
          tenantId,
          adminEmail,
          employeeId,
          employeeFirstName: rest.employeeFirstName,
          employeeLastName: rest.employeeLastName,
          lastWorkingDate: rest.lastWorkingDate,
          reason: rest.reason,
          additionalNotes: rest.additionalNotes,
          detailLink: rest.detailLink,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to emit resignation notification for employee ${employeeId}`,
            err,
          ),
        );
    }
  }
}
