import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AssigneesModule } from '../assignees/assignees.module';
import { FleetModule } from '../fleet/fleet.module';
import { TripScheduleModule } from '../trips/trip-schedule.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesTargetsModule } from '../sales-targets/sales-targets.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TransportDashboardController } from './transport-dashboard.controller';
import { TransportDashboardService } from './transport-dashboard.service';

@Module({
  imports: [
    AssigneesModule,
    AuthModule,
    PrismaModule,
    AccountingModule,
    SalesTargetsModule,
    FleetModule,
    TripScheduleModule,
  ],
  controllers: [DashboardController, TransportDashboardController],
  providers: [DashboardService, TransportDashboardService],
})
export class DashboardModule {}
