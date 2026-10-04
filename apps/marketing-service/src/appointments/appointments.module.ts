import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuthDirectoryClient } from './auth-directory.client';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AuthDirectoryClient],
})
export class AppointmentsModule {}
