import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationHandler } from './notification.handler';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';

@Module({
  controllers: [NotificationHandler],
  providers: [NotificationService, EmailService, SmsService],
})
export class NotificationModule {}
