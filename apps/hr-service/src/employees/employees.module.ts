import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';

@Module({
  imports: [LeaveModule, RabbitMQModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
