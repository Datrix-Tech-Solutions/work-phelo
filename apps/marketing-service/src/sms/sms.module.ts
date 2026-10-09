import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantMarketingEnabledGuard } from '../auth/guards/tenant-marketing-enabled.guard';
import { DnsTxtResolver } from './dns-txt-resolver';
import { PlatformSmsController } from './platform-sms.controller';
import { SmsSenderIdentitiesController } from './sms-sender-identities.controller';
import { SmsSenderIdentitiesService } from './sms-sender-identities.service';
import { SmsWalletController } from './sms-wallet.controller';
import { SmsWalletService } from './sms-wallet.service';
import { TenantDomainsController } from './tenant-domains.controller';
import { TenantDomainsService } from './tenant-domains.service';
import { TenantModulesClient } from './tenant-modules.client';

@Module({
  imports: [AuthModule, PrismaModule, MessagingModule],
  controllers: [
    SmsSenderIdentitiesController,
    SmsWalletController,
    TenantDomainsController,
    PlatformSmsController,
  ],
  providers: [
    SmsSenderIdentitiesService,
    SmsWalletService,
    TenantDomainsService,
    DnsTxtResolver,
    TenantModulesClient,
    TenantMarketingEnabledGuard,
  ],
  exports: [SmsSenderIdentitiesService, SmsWalletService],
})
export class SmsModule {}
