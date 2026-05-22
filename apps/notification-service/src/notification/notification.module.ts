import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationHandler } from './notification.handler';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [InAppNotificationsModule],
  controllers: [NotificationHandler],
  providers: [NotificationService, EmailService, SmsService],
})
export class NotificationModule {}
