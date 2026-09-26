import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingSettingsController } from './accounting-settings.controller';
import { AccountsController } from './accounts.controller';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { BankReconciliationsController } from './bank-reconciliations.controller';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { EntityTypesController } from './entity-types.controller';
import { EntityTypesService } from './entity-types.service';
import { InternalSubledgersController } from './internal-subledgers.controller';
import { JournalPolicy } from './journal.policy';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';
import { PayrollIntegrationController } from './payroll-integration.controller';
import { PayrollIntegrationService } from './payroll-integration.service';
import { RecurringJournalsController } from './recurring-journals.controller';
import { RecurringJournalsCron } from './recurring-journals.cron';
import { RecurringJournalsService } from './recurring-journals.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { SourceTypesController } from './source-types.controller';
import { SourceTypesService } from './source-types.service';
import { TransactionTypeRulesController } from './transaction-type-rules.controller';
import { TransactionTypeRulesService } from './transaction-type-rules.service';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [
    AccountingSettingsController,
    AccountsController,
    CashbookController,
    BankReconciliationsController,
    BudgetsController,
    EntityTypesController,
    InternalSubledgersController,
    JournalsController,
    PayablesController,
    PayrollIntegrationController,
    RecurringJournalsController,
    ReceivablesController,
    ReportsController,
    SourceTypesController,
    TransactionTypeRulesController,
  ],
  providers: [
    AccountingMasterDataService,
    CashbookService,
    BankReconciliationsService,
    BudgetsService,
    EntityTypesService,
    JournalPolicy,
    JournalsService,
    PayablesService,
    PayrollIntegrationService,
    RecurringJournalsCron,
    RecurringJournalsService,
    ReceivablesService,
    ReportsService,
    SourceTypesService,
    TransactionTypeRulesService,
  ],
  exports: [
    AccountingMasterDataService,
    CashbookService,
    EntityTypesService,
    JournalsService,
    PayablesService,
    ReceivablesService,
    ReportsService,
    SourceTypesService,
    TransactionTypeRulesService,
  ],
})
export class LedgerModule {}
