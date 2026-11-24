import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { BankReconciliationsService } from './bank-reconciliations.service';
import {
  CompleteBankReconciliationDto,
  QueryBankReconciliationsDto,
  ReconciledEntriesQueryDto,
} from './dto/bank-reconciliations.dto';

@Controller('bank-reconciliations')
@ApiTags('Accounting - Bank Reconciliations')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class BankReconciliationsController {
  constructor(private readonly service: BankReconciliationsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant bank reconciliation sessions' })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  list(
    @Query() query: QueryBankReconciliationsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Save a completed bank reconciliation',
    description:
      'Saves the reconciliation, every statement row the user brought and the ledger line each matched row was reconciled against, in one step. Statement values are stored, never the file. No journal is posted.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_MANAGE)
  complete(
    @Body() dto: CompleteBankReconciliationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.complete(request.user, dto);
  }

  @Get('reconciled-entries')
  @ApiOperation({
    summary:
      'List the ledger lines of a cash account that are already reconciled',
    description:
      'Used by the reconcile page to leave out entries a completed reconciliation has already taken care of.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  reconciledEntries(
    @Query() query: ReconciledEntriesQueryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reconciledJournalLineIds(
      request.user.tenantId,
      query.cashAccountId,
    );
  }

  @Get(':reconciliationId')
  @ApiOperation({ summary: 'Get a tenant bank reconciliation session' })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_VIEW)
  get(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.get(request.user.tenantId, reconciliationId);
  }
}
