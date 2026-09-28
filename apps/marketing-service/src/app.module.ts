import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CrmSettingsModule } from './crm-settings/crm-settings.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProspectsModule } from './prospects/prospects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    PrismaModule,
    CrmSettingsModule,
    ProspectsModule,
  ],
})
export class AppModule {}
