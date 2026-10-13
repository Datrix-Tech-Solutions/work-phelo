import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import {
  CreatePayrollRoleAccountDto,
  SeedPayrollAccountsDto,
  SetPayrollAccountMappingDto,
  UpdatePayrollAccountingSettingsDto,
} from './dto/payroll-integration.dto';
import { PayrollIntegrationService } from './payroll-integration.service';
import { PayrollSetupService } from './payroll-setup.service';

@Controller('payroll-integration')
@ApiTags('Accounting - Payroll Integration')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class PayrollIntegrationController {
  constructor(
    private readonly service: PayrollIntegrationService,
    private readonly setup: PayrollSetupService,
  ) {}

  @Get('setup')
  @ApiOperation({
    summary:
      'Payroll set-up: which account handles each payroll function, whether payroll is linked and ready, and how it is posted',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  getSetup(@Req() request: Request & { user: RequestUser }) {
    return this.setup.getSetup(request.user.tenantId);
  }

  @Put('mapping/:role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Choose the account that handles a payroll function (or clear it). Applies to future payroll runs only.',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  setMapping(
    @Param('role') role: string,
    @Body() dto: SetPayrollAccountMappingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.setup.setMapping(request.user, role, dto.glAccountId);
  }

  @Post('mapping/:role/create-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Create a new account for a payroll function and use it for that function',
  })
  @RequirePermissions(
    AccountingPermission.SETTINGS_EDIT,
    AccountingPermission.ACCOUNTS_CREATE,
  )
  createRoleAccount(
    @Param('role') role: string,
    @Body() dto: CreatePayrollRoleAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createAccountForRole(request.user, role, dto.name);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'How payroll accruals are posted' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateSettings(
    @Body() dto: UpdatePayrollAccountingSettingsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.setup.setAutoPost(
      request.user.tenantId,
      dto.autoPostOnApproval,
    );
  }

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
