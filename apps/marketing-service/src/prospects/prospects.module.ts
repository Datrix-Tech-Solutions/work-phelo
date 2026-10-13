import { Module } from '@nestjs/common';
import { AssigneesModule } from '../assignees/assignees.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectFollowUpsController } from './prospect-follow-ups.controller';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [AuthModule, PrismaModule, AssigneesModule],
  controllers: [ProspectsController, ProspectFollowUpsController],
  providers: [ProspectsService],
})
export class ProspectsModule {}
