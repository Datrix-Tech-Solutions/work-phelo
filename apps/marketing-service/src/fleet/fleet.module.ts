import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { HrFleetClient } from './hr-fleet.client';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FleetController],
  providers: [FleetService, HrFleetClient],
})
export class FleetModule {}
