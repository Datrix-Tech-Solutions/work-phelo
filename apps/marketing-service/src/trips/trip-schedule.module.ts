import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TripScheduleService } from './trip-schedule.service';

@Module({
  imports: [PrismaModule],
  providers: [TripScheduleService],
  exports: [TripScheduleService],
})
export class TripScheduleModule {}
