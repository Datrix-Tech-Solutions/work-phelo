import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import {
  CampaignDeliveryResultEvent,
  EventPatterns,
  WithMeta,
} from '@work-phelo/types';
import { CampaignsService } from './campaigns.service';

@Controller()
export class CampaignDeliveryResultsController {
  private readonly logger = new Logger(CampaignDeliveryResultsController.name);

  constructor(private readonly campaigns: CampaignsService) {}

  @EventPattern(EventPatterns.MARKETING_CAMPAIGN_DELIVERY_RESULT)
  async handleCampaignDeliveryResult(
    @Payload() data: WithMeta<CampaignDeliveryResultEvent>,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    try {
      await this.campaigns.applyDeliveryResult(data);
      channel.ack(message);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `[${EventPatterns.MARKETING_CAMPAIGN_DELIVERY_RESULT}] Failed | tenant=${data.tenantId} | campaign=${data.campaignId} | recipient=${data.recipientId} | error=${detail}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
    }
  }
}
