import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AssigneesModule } from '../assignees/assignees.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientBillingController } from './client-billing.controller';
import { ClientBillingService } from './client-billing.service';
import {
  ClientsController,
  ProspectConversionController,
} from './clients.controller';
import { ClientsService } from './clients.service';
import { InternalAccountingEventsController } from './internal-accounting-events.controller';

@Module({
  imports: [AuthModule, PrismaModule, AccountingModule, AssigneesModule],
  // ClientBillingController first: `clients/billing/options` must not be read as a client id.
  controllers: [
    ClientBillingController,
    ClientsController,
    ProspectConversionController,
    InternalAccountingEventsController,
  ],
  providers: [ClientsService, ClientBillingService],
})
export class ClientsModule {}
