import { Module } from '@nestjs/common';
import { AccountingClient } from './accounting.client';

@Module({
  providers: [AccountingClient],
  exports: [AccountingClient],
})
export class AccountingModule {}
