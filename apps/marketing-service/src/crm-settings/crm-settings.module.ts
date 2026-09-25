import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PipelineStagesController } from './pipeline-stages.controller';
import { PipelineStagesService } from './pipeline-stages.service';
import { ProspectingSettingsController } from './prospecting-settings.controller';
import { ProspectingSettingsService } from './prospecting-settings.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PipelineStagesController, ProspectingSettingsController],
  providers: [PipelineStagesService, ProspectingSettingsService],
})
export class CrmSettingsModule {}
