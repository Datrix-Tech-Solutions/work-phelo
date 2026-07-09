import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingSettingsController } from './accounting-settings.controller';
import { AccountsController } from './accounts.controller';
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
    JournalsController,
    ReportsController,
  ],
  providers: [
    AccountingMasterDataService,
    JournalPolicy,
    JournalsService,
    ReportsService,
  ],
  exports: [AccountingMasterDataService, JournalsService, ReportsService],
})
export class LedgerModule {}
