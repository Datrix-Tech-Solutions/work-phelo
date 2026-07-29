import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';
import { ReinsuranceAccountingEventBuilder } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxService,
  ],
  exports: [
    ReinsuranceAccountingClient,
    ReinsuranceAccountingEventBuilder,
    ReinsuranceAccountingOutboxService,
  ],
})
export class ReinsuranceAccountingIntegrationModule {}
