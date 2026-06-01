import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessClassSettingsController } from './business-class-settings.controller';
import { RiskClassSettingsService } from './risk-class-settings.service';
import { RiskTypeSettingsService } from './risk-type-settings.service';

/**
 * Retained for backward compatibility. Registers the alias controller at
 * /settings/business-classes alongside both new services. Remove in PR3.
 */
@Module({
  imports: [PrismaModule],
  controllers: [BusinessClassSettingsController],
  providers: [RiskClassSettingsService, RiskTypeSettingsService],
  exports: [RiskClassSettingsService, RiskTypeSettingsService],
})
export class BusinessClassSettingsModule {}
