import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HrFleetClient } from '../fleet/hr-fleet.client';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaModule } from '../prisma/prisma.module';
import { TransportOfficersModule } from '../transport-officers/transport-officers.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthModule, PrismaModule, TransportOfficersModule],
  controllers: [RequestsController],
  providers: [RequestsService, HrDirectoryClient, HrFleetClient],
})
export class RequestsModule {}
