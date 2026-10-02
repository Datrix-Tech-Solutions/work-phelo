import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ClientsController,
  ProspectConversionController,
} from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ClientsController, ProspectConversionController],
  providers: [ClientsService],
})
export class ClientsModule {}
