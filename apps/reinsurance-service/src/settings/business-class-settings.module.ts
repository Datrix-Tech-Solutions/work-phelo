import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessClassSettingsController } from './business-class-settings.controller';
import { BusinessClassSettingsService } from './business-class-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessClassSettingsController],
  providers: [BusinessClassSettingsService],
  exports: [BusinessClassSettingsService],
})
export class BusinessClassSettingsModule {}
