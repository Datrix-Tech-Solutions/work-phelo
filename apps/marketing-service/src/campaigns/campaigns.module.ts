import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  CAMPAIGN_DISPATCHER,
  NoopCampaignDispatcher,
} from './campaign-dispatcher';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    // Swap for the RabbitMQ/BullMQ dispatcher once SMS and email delivery exist.
    { provide: CAMPAIGN_DISPATCHER, useClass: NoopCampaignDispatcher },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
