import { Module } from '@nestjs/common';
import { PayrollGroupsController } from './payroll-groups.controller';
import { PayrollGroupsService } from './payroll-groups.service';

@Module({
  controllers: [PayrollGroupsController],
  providers: [PayrollGroupsService],
  exports: [PayrollGroupsService],
})
export class PayrollGroupsModule {}
