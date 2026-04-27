import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeaveModule } from '../leave/leave.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeStatusCronService } from './employee-status.cron';
import {
  RESIGNATION_QUEUE,
  ResignationNotificationProcessor,
} from './resignation-notification.processor';

@Module({
  imports: [
    LeaveModule,
    RabbitMQModule,
    NotificationsModule,
    BullModule.registerQueue({ name: RESIGNATION_QUEUE }),
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeStatusCronService,
    ResignationNotificationProcessor,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
