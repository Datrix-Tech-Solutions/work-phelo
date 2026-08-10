import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingSettingsController } from './accounting-settings.controller';
import { AccountsController } from './accounts.controller';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { InternalSubledgersController } from './internal-subledgers.controller';
import { JournalPolicy } from './journal.policy';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AccountingSettingsController,
    AccountsController,
    CashbookController,
    InternalSubledgersController,
    JournalsController,
    ReportsController,
  ],
  providers: [
    AccountingMasterDataService,
    CashbookService,
    JournalPolicy,
    JournalsService,
    ReportsService,
  ],
  exports: [
    AccountingMasterDataService,
    CashbookService,
    JournalsService,
    ReportsService,
  ],
})
export class LedgerModule {}
