import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AssigneesModule } from '../assignees/assignees.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesTargetsModule } from '../sales-targets/sales-targets.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AssigneesModule,
    AuthModule,
    PrismaModule,
    AccountingModule,
    SalesTargetsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
