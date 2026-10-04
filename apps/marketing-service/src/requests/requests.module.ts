import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RequestNotifier } from './request-notifier.service';
import { HrFleetClient } from '../fleet/hr-fleet.client';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaModule } from '../prisma/prisma.module';
import { TripScheduleModule } from '../trips/trip-schedule.module';
import { TransportOfficersModule } from '../transport-officers/transport-officers.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [
    AuthModule,
    MessagingModule,
    PrismaModule,
    TransportOfficersModule,
    TripScheduleModule,
  ],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    RequestNotifier,
    HrDirectoryClient,
    HrFleetClient,
  ],
})
export class RequestsModule {}
