import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { ReinsuranceAccountingOperationAuditInterceptor } from './reinsurance-accounting-operation-audit.interceptor';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';
import { ReinsuranceAccountingIntegrationConfigClient } from './reinsurance-accounting-integration-config.client';
import { ReinsuranceAccountingIntegrationActiveGuard } from './reinsurance-accounting-integration-active.guard';
import { ReinsuranceAccountingEventBuilder } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingIntegrationController } from './reinsurance-accounting-integration.controller';
import { ReinsuranceAccountingOutboxDispatcher } from './reinsurance-accounting-outbox-dispatcher.service';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';
import { ReinsuranceAccountingReadinessService } from './reinsurance-accounting-readiness.service';
import { ReinsuranceFinancialEventPublisher } from './reinsurance-financial-event-publisher.service';

@Module({
  imports: [PrismaModule, AuthModule, RabbitMQModule],
  controllers: [ReinsuranceAccountingIntegrationController],
  providers: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingIntegrationConfigClient,
    ReinsuranceAccountingIntegrationActiveGuard,
    ReinsuranceAccountingOperationAuditInterceptor,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
  exports: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingIntegrationConfigClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxDispatcher,
    ReinsuranceAccountingOutboxService,
    ReinsuranceAccountingReadinessService,
    ReinsuranceFinancialEventPublisher,
  ],
})
export class ReinsuranceAccountingIntegrationModule {}
