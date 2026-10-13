import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TripScheduleModule } from '../trips/trip-schedule.module';
import { TransportOfficersModule } from '../transport-officers/transport-officers.module';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { HrFleetClient } from './hr-fleet.client';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    TransportOfficersModule,
    TripScheduleModule,
  ],
  controllers: [FleetController],
  providers: [FleetService, HrFleetClient],
})
export class FleetModule {}
