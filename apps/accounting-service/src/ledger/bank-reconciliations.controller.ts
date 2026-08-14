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
  CreateBankReconciliationDto,
  QueryBankReconciliationsDto,
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
    summary: 'Create a draft bank reconciliation session',
    description:
      'Creates only the reconciliation header. Statement import, matching and adjustment posting are separate controlled workflows.',
  })
  @RequirePermissions(AccountingPermission.BANK_RECONCILIATIONS_MANAGE)
  create(
    @Body() dto: CreateBankReconciliationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
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
