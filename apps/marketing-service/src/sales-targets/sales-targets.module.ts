import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AssigneesModule } from '../assignees/assignees.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesTargetsController } from './sales-targets.controller';
import { SalesTargetsService } from './sales-targets.service';

@Module({
  imports: [AuthModule, PrismaModule, AccountingModule, AssigneesModule],
  controllers: [SalesTargetsController],
  providers: [SalesTargetsService],
})
export class SalesTargetsModule {}
