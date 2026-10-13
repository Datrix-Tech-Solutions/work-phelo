import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotifier } from './appointment-notifier.service';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthDirectoryClient } from './auth-directory.client';

@Module({
  imports: [AuthModule, PrismaModule, MessagingModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AuthDirectoryClient, AppointmentNotifier],
})
export class AppointmentsModule {}
