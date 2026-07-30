import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';
import { ReinsuranceAccountingEventBuilder } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingIntegrationController } from './reinsurance-accounting-integration.controller';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';
import { ReinsuranceAccountingReadinessService } from './reinsurance-accounting-readiness.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReinsuranceAccountingIntegrationController],
  providers: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
  ],
  exports: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
  ],
})
export class ReinsuranceAccountingIntegrationModule {}
