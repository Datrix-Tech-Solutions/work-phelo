import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PipelineStagesController } from './pipeline-stages.controller';
import { PipelineStagesService } from './pipeline-stages.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PipelineStagesController],
  providers: [PipelineStagesService],
})
export class CrmSettingsModule {}
