import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';
import { ReinsuranceAccountingEventBuilder } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingIntegrationController } from './reinsurance-accounting-integration.controller';
import { ReinsuranceAccountingOutboxDispatcher } from './reinsurance-accounting-outbox-dispatcher.service';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';
import { ReinsuranceAccountingReadinessService } from './reinsurance-accounting-readiness.service';
import { ReinsuranceFinancialEventPublisher } from './reinsurance-financial-event-publisher.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReinsuranceAccountingIntegrationController],
  providers: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
  exports: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
})
export class ReinsuranceAccountingIntegrationModule {}
