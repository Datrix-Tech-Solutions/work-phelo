import { Module } from '@nestjs/common';
import { AssigneesModule } from '../assignees/assignees.module';
import { AuthModule } from '../auth/auth.module';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesTargetsModule } from '../sales-targets/sales-targets.module';
import { ReportsController } from './reports.controller';
import { TargetReportService } from './target-report.service';

@Module({
  imports: [AuthModule, PrismaModule, AssigneesModule, SalesTargetsModule],
  controllers: [ReportsController],
  providers: [TargetReportService, HrDirectoryClient],
})
export class ReportsModule {}
