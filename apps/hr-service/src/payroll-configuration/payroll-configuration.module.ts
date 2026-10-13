import { Module } from '@nestjs/common';
import { PayrollConfigurationService } from './payroll-configuration.service';
import {
  PayrollConfigurationController,
  PayrollSavedComponentController,
} from './payroll-configuration.controller';

@Module({
  controllers: [
    PayrollConfigurationController,
    PayrollSavedComponentController,
  ],
  providers: [PayrollConfigurationService],
  exports: [PayrollConfigurationService],
})
export class PayrollConfigurationModule {}
