import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { AccountingHrClient } from '../hr-integration/client/hr.client';
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
import { InternalPayrollIntegrationController } from './internal-payroll-integration.controller';
import { InternalSubledgersController } from './internal-subledgers.controller';
import { JournalPolicy } from './journal.policy';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';
import { PayrollIntegrationController } from './payroll-integration.controller';
import { PayrollIntegrationService } from './payroll-integration.service';
import { PayrollSetupService } from './payroll-setup.service';
import { RecurringJournalsController } from './recurring-journals.controller';
import { RecurringJournalsCron } from './recurring-journals.cron';
import { RecurringJournalsService } from './recurring-journals.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { SourceLedgerController } from './source-ledger.controller';
import { SourceLedgerService } from './source-ledger.service';
import { SourceTypesController } from './source-types.controller';
import { SourceTypesService } from './source-types.service';
import { InternalPaymentRequestsController } from './payment-requests/internal-payment-requests.controller';
import { PaymentRequestsController } from './payment-requests/payment-requests.controller';
import { PaymentRequestsService } from './payment-requests/payment-requests.service';
import { InternalSourceTransactionsController } from './source-transactions/internal-source-transactions.controller';
import { SourceEventsNotifier } from './source-transactions/source-events.notifier';
import { SourceProvisioningService } from './source-transactions/source-provisioning.service';
import { SourceTransactionsService } from './source-transactions/source-transactions.service';
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
    InternalPayrollIntegrationController,
    InternalPaymentRequestsController,
    InternalSourceTransactionsController,
    InternalSubledgersController,
    JournalsController,
    PayablesController,
    PaymentRequestsController,
    PayrollIntegrationController,
    RecurringJournalsController,
    ReceivablesController,
    ReportsController,
    SourceLedgerController,
    SourceTypesController,
    TransactionTypeRulesController,
  ],
  providers: [
    AccountingHrClient,
    AccountingMasterDataService,
    CashbookService,
    BankReconciliationsService,
    BudgetsService,
    EntityTypesService,
    JournalPolicy,
    JournalsService,
    PayablesService,
    PaymentRequestsService,
    PayrollIntegrationService,
    PayrollSetupService,
    RecurringJournalsCron,
    RecurringJournalsService,
    ReceivablesService,
    ReportsService,
    SourceEventsNotifier,
    SourceLedgerService,
    SourceProvisioningService,
    SourceTransactionsService,
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
    SourceLedgerService,
    SourceTypesService,
    TransactionTypeRulesService,
  ],
})
export class LedgerModule {}
