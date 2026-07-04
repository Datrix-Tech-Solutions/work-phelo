import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingSettingsController } from './accounting-settings.controller';
import { AccountsController } from './accounts.controller';
import { JournalPolicy } from './journal.policy';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AccountingSettingsController,
    AccountsController,
    JournalsController,
  ],
  providers: [AccountingMasterDataService, JournalPolicy, JournalsService],
  exports: [AccountingMasterDataService, JournalsService],
})
export class LedgerModule {}
