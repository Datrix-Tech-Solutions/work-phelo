import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { InternalPayrollSettlementController } from './internal-payroll-settlement.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AccountingIntegrationModule } from '../accounting-integration/accounting-integration.module';

@Module({
  imports: [
    NotificationsModule,
    RabbitMQModule,
    CryptoModule,
    AccountingIntegrationModule,
  ],
  controllers: [PayrollController, InternalPayrollSettlementController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
