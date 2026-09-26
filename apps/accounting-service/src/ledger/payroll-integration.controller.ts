import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
import { SeedPayrollAccountsDto } from './dto/payroll-integration.dto';
import { PayrollIntegrationService } from './payroll-integration.service';

@Controller('payroll-integration')
@ApiTags('Accounting - Payroll Integration')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class PayrollIntegrationController {
  constructor(private readonly service: PayrollIntegrationService) {}

  @Post('seed-accounts')
  @ApiOperation({
    summary:
      'Idempotently seed the payroll GL accounts, the aggregate Employee entity, and the ' +
      'HR/Payroll source type entry',
  })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_CREATE)
  seedAccounts(
    @Body() dto: SeedPayrollAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.seedAccounts(request.user, dto);
  }
}
