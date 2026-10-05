import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CampaignDeliveryChannel } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingRabbitPublisher } from '../messaging/rabbitmq.publisher';

/**
 * Hands a saved campaign to whatever actually sends it. The campaigns service
 * calls this after the campaign and its recipient rows are committed, so the
 * real SMS/email pipeline only has to replace the provider bound to
 * CAMPAIGN_DISPATCHER in CampaignsModule.
 */
export interface CampaignDispatcher {
  /** Send now (INSTANT) or arrange to send on the scheduled date (SCHEDULED). */
  dispatch(campaignId: string): Promise<void>;
  /** Stop a scheduled campaign from sending. Called after it is marked CANCELLED. */
  cancel(campaignId: string): Promise<void>;
}

export const CAMPAIGN_DISPATCHER = Symbol('CAMPAIGN_DISPATCHER');

/** Placeholder until SMS/email delivery is set up: campaigns stay unsent. */
@Injectable()
export class NoopCampaignDispatcher implements CampaignDispatcher {
  private readonly logger = new Logger(NoopCampaignDispatcher.name);

  dispatch(campaignId: string): Promise<void> {
    this.logger.log(
      `Campaign ${campaignId} saved; delivery is not configured, nothing was sent`,
    );
    return Promise.resolve();
  }

  cancel(campaignId: string): Promise<void> {
    this.logger.log(`Campaign ${campaignId} cancelled; nothing to unschedule`);
    return Promise.resolve();
  }
}

@Injectable()
export class RabbitMqCampaignDispatcher implements CampaignDispatcher {
  private readonly logger = new Logger(RabbitMqCampaignDispatcher.name);
  private readonly batchSize = Math.min(
    Math.max(
      Number(process.env.MARKETING_CAMPAIGN_DISPATCH_BATCH_SIZE ?? 100),
      1,
    ),
    500,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MarketingRabbitPublisher,
  ) {}

  async dispatch(campaignId: string): Promise<void> {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        tenantId: true,
        subject: true,
        message: true,
        channels: true,
        senderIdentityId: true,
        senderIdSnapshot: true,
        smsReservationId: true,
      },
    });
    if (!campaign) throw new BadRequestException('Campaign not found');
    if (
      !campaign.channels.includes('SMS') ||
      campaign.channels.includes('EMAIL')
    ) {
      throw new BadRequestException(
        'Only SMS-only campaigns can be dispatched in this phase',
      );
    }
    if (!campaign.senderIdSnapshot || !campaign.smsReservationId) {
      throw new BadRequestException(
        'Campaign requires sender and credit reservation before dispatch',
      );
    }

    const recipients = await this.prisma.marketingCampaignRecipient.findMany({
      where: {
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        channel: 'SMS',
        status: 'PENDING',
        address: { not: null },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        address: true,
        contactName: true,
        segmentCount: true,
        estimatedCredits: true,
      },
    });
    if (recipients.length === 0) {
      throw new BadRequestException('Campaign has no pending SMS recipients');
    }

    for (let index = 0; index < recipients.length; index += this.batchSize) {
      const batch = recipients.slice(index, index + this.batchSize);
      const batchId = `${campaign.id}:${index / this.batchSize + 1}`;
      await this.prisma.marketingCampaignRecipient.updateMany({
        where: {
          tenantId: campaign.tenantId,
          campaignId: campaign.id,
          id: { in: batch.map((recipient) => recipient.id) },
          status: 'PENDING',
        },
        data: {
          status: 'QUEUED',
          smsReservationId: campaign.smsReservationId,
        },
      });
      await this.publisher.campaignDispatchBatch({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        batchId,
        channel: 'SMS' satisfies CampaignDeliveryChannel,
        senderIdentityId: campaign.senderIdentityId ?? undefined,
        senderId: campaign.senderIdSnapshot,
        reservationId: campaign.smsReservationId,
        subject: campaign.subject,
        message: campaign.message,
        recipients: batch.map((recipient) => ({
          recipientId: recipient.id,
          channel: 'SMS',
          address: recipient.address ?? '',
          contactName: recipient.contactName,
          segmentCount: recipient.segmentCount ?? undefined,
          estimatedCredits: recipient.estimatedCredits ?? undefined,
          idempotencyKey: `${campaign.id}:${recipient.id}:sms`,
        })),
      });
      this.logger.log(
        `Published SMS campaign batch ${batchId} for campaign=${campaign.id} recipients=${batch.length}`,
      );
    }
  }

  cancel(campaignId: string): Promise<void> {
    this.logger.log(`Campaign ${campaignId} cancelled in Marketing state`);
    return Promise.resolve();
  }
}
