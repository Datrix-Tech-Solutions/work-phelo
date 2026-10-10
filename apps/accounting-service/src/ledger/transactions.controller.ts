import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from './accounting.permissions';
import { QueryTransactionsDto } from './dto/transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@ApiTags('Accounting - Transactions')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List transactions of every kind, one page at a time',
    description:
      'Invoices, bills, credit/debit notes and direct cashbook entries, newest first. Filtering, search and paging are done in the database.',
  })
  @RequirePermissions(
    AccountingPermission.RECEIVABLES_VIEW,
    AccountingPermission.PAYABLES_VIEW,
    AccountingPermission.CASHBOOK_VIEW,
  )
  list(
    @Query() query: QueryTransactionsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }
}
