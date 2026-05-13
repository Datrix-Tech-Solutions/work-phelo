import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';

@Module({
  imports: [NotificationsModule, RabbitMQModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
