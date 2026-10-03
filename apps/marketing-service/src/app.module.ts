import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from './clients/clients.module';
import { FleetModule } from './fleet/fleet.module';
import { CrmSettingsModule } from './crm-settings/crm-settings.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProspectsModule } from './prospects/prospects.module';
import { RequestsModule } from './requests/requests.module';
import { TransportOfficersModule } from './transport-officers/transport-officers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    PrismaModule,
    CrmSettingsModule,
    ProspectsModule,
    ClientsModule,
    FleetModule,
    RequestsModule,
    TransportOfficersModule,
  ],
})
export class AppModule {}
