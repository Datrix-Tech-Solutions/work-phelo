import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantMarketingEnabledGuard } from '../auth/guards/tenant-marketing-enabled.guard';
import { PlatformSmsController } from './platform-sms.controller';
import { SmsSenderIdentitiesController } from './sms-sender-identities.controller';
import { SmsSenderIdentitiesService } from './sms-sender-identities.service';
import { SmsWalletController } from './sms-wallet.controller';
import { SmsWalletService } from './sms-wallet.service';
import { TenantModulesClient } from './tenant-modules.client';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    SmsSenderIdentitiesController,
    SmsWalletController,
    PlatformSmsController,
  ],
  providers: [
    SmsSenderIdentitiesService,
    SmsWalletService,
    TenantModulesClient,
    TenantMarketingEnabledGuard,
  ],
  exports: [SmsSenderIdentitiesService, SmsWalletService],
})
export class SmsModule {}
