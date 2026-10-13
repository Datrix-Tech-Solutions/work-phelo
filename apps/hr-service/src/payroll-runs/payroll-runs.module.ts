import { Module } from '@nestjs/common';
import { PayrollModule } from '../payroll/payroll.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PayrollRunsController } from './payroll-runs.controller';
import { PayrollRunsService } from './payroll-runs.service';

@Module({
  imports: [PayrollModule, RabbitMQModule],
  controllers: [PayrollRunsController],
  providers: [PayrollRunsService],
})
export class PayrollRunsModule {}
