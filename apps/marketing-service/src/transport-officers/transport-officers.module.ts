import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaModule } from '../prisma/prisma.module';
import { TransportOfficersController } from './transport-officers.controller';
import { TransportOfficersService } from './transport-officers.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TransportOfficersController],
  providers: [TransportOfficersService, HrDirectoryClient],
  // Fleet and requests read their driver lists from here.
  exports: [TransportOfficersService],
})
export class TransportOfficersModule {}
