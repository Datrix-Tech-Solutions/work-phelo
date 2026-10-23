import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmPreferencesController } from './crm-preferences.controller';
import { CrmPreferencesService } from './crm-preferences.service';
import { CrmSettingsUsageController } from './crm-settings-usage.controller';
import { PipelineStagesController } from './pipeline-stages.controller';
import { PipelineStagesService } from './pipeline-stages.service';
import { ProspectingSettingsController } from './prospecting-settings.controller';
import { ProspectingSettingsService } from './prospecting-settings.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    ProspectingSettingsController,
    PipelineStagesController,
    CrmSettingsUsageController,
    CrmPreferencesController,
  ],
  providers: [
    ProspectingSettingsService,
    PipelineStagesService,
    CrmPreferencesService,
  ],
})
export class CrmSettingsModule {}
