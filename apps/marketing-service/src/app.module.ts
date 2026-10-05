import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssigneesModule } from './assignees/assignees.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClientsModule } from './clients/clients.module';
import { FleetModule } from './fleet/fleet.module';
import { CrmSettingsModule } from './crm-settings/crm-settings.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProspectsModule } from './prospects/prospects.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { RequestsModule } from './requests/requests.module';
import { SmsModule } from './sms/sms.module';
import { TransportOfficersModule } from './transport-officers/transport-officers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    PrismaModule,
    CrmSettingsModule,
    ProspectsModule,
    ClientsModule,
    AssigneesModule,
    CampaignsModule,
    FleetModule,
    AppointmentsModule,
    RequestsModule,
    SmsModule,
    TransportOfficersModule,
  ],
})
export class AppModule {}
