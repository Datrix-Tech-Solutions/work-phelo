import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsModule } from '../sms/sms.module';
import {
  CAMPAIGN_DISPATCHER,
  RabbitMqCampaignDispatcher,
} from './campaign-dispatcher';
import { CampaignDeliveryResultsController } from './campaign-delivery-results.controller';
import { CampaignSegmentsController } from './campaign-segments.controller';
import { CampaignSegmentsService } from './campaign-segments.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';

@Module({
  imports: [AuthModule, PrismaModule, SmsModule, MessagingModule],
  // Segments first, so `campaigns/segments` is never matched by `campaigns/:id`.
  controllers: [
    CampaignSegmentsController,
    CampaignsController,
    CampaignDeliveryResultsController,
  ],
  providers: [
    CampaignsService,
    CampaignSegmentsService,
    CampaignSchedulerService,
    { provide: CAMPAIGN_DISPATCHER, useClass: RabbitMqCampaignDispatcher },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
