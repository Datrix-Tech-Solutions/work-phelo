import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectFollowUpsController } from './prospect-follow-ups.controller';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProspectsController, ProspectFollowUpsController],
  providers: [ProspectsService],
})
export class ProspectsModule {}
