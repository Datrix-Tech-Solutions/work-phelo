import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationHandler } from './notification.handler';
import { AgooSmsProvider } from '../channels/agoosms-sms.provider';
import { EmailService } from '../channels/email.service';
import { PiloSmsProvider } from '../channels/pilosms.provider';
import { SasuSyncSmsProvider } from '../channels/sasusync-sms.provider';
import { SmsService } from '../channels/sms.service';
import { TermiiSmsProvider } from '../channels/termii-sms.provider';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { MarketingRabbitPublisher } from '../messaging/marketing-rabbit.publisher';

@Module({
  imports: [InAppNotificationsModule],
  controllers: [NotificationHandler],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    TermiiSmsProvider,
    PiloSmsProvider,
    SasuSyncSmsProvider,
    AgooSmsProvider,
    MarketingRabbitPublisher,
  ],
})
export class NotificationModule {}
