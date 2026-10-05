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
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';

@Module({
  imports: [AuthModule, PrismaModule, SmsModule, MessagingModule],
  controllers: [CampaignsController, CampaignDeliveryResultsController],
  providers: [
    CampaignsService,
    CampaignSchedulerService,
    { provide: CAMPAIGN_DISPATCHER, useClass: RabbitMqCampaignDispatcher },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
