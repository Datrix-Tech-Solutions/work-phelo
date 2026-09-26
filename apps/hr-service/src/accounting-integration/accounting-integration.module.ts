import { Module } from '@nestjs/common';
import { HrAccountingClient } from './client/accounting.client';

@Module({
  providers: [HrAccountingClient],
  exports: [HrAccountingClient],
})
export class AccountingIntegrationModule {}
