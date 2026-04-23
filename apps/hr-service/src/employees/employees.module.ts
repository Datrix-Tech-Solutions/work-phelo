import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeStatusCronService } from './employee-status.cron';

@Module({
  imports: [LeaveModule, RabbitMQModule, NotificationsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeStatusCronService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
