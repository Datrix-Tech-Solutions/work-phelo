import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { FiscalPeriodStatus } from '../../prisma/generated/client';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingPermission } from './accounting.permissions';
import {
  CreateAccountingCurrencyDto,
  CreateExchangeRateDto,
  CreateFiscalPeriodDto,
  GenerateFiscalYearDto,
  CreateTransactionTypeDto,
  QueryFiscalPeriodsDto,
  UpdateAccountingCurrencyDto,
  UpdateAccountingTenantConfigDto,
  UpdateExchangeRateDto,
  UpdateTransactionTypeDto,
} from './dto/accounting.dto';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class AccountingSettingsController {
  constructor(private readonly service: AccountingMasterDataService) {}

  @Get('config')
  @ApiTags('Accounting - Configuration')
  @ApiOperation({ summary: 'Get tenant Accounting configuration' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  getConfig(@Req() request: Request & { user: RequestUser }) {
    return this.service.getConfig(request.user.tenantId);
  }

  @Patch('config')
  @ApiTags('Accounting - Configuration')
  @ApiOperation({ summary: 'Create or update tenant Accounting configuration' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateConfig(
    @Body() dto: UpdateAccountingTenantConfigDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateConfig(request.user, dto);
  }

  @Get('currencies')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'List tenant Accounting currencies' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listCurrencies(@Req() request: Request & { user: RequestUser }) {
    return this.service.listCurrencies(request.user.tenantId);
  }

  @Post('currencies')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Create an Accounting currency' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createCurrency(
    @Body() dto: CreateAccountingCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCurrency(request.user, dto);
  }

  @Patch('currencies/:currencyId')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Update or deactivate an Accounting currency' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateCurrency(
    @Param('currencyId', ParseUUIDPipe) currencyId: string,
    @Body() dto: UpdateAccountingCurrencyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateCurrency(request.user, currencyId, dto);
  }

  @Get('exchange-rates')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'List tenant exchange rates' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listExchangeRates(@Req() request: Request & { user: RequestUser }) {
    return this.service.listExchangeRates(request.user.tenantId);
  }

  @Post('exchange-rates')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Create an effective-dated exchange rate' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createExchangeRate(
    @Body() dto: CreateExchangeRateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createExchangeRate(request.user, dto);
  }

  @Patch('exchange-rates/:rateId')
  @ApiTags('Accounting - Currencies')
  @ApiOperation({ summary: 'Update or deactivate an exchange rate' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateExchangeRate(
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @Body() dto: UpdateExchangeRateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateExchangeRate(request.user, rateId, dto);
  }

  @Get('fiscal-years')
  @ApiTags('Accounting - Fiscal Years')
  @ApiOperation({
    summary: 'List fiscal years',
    description:
      'Each year carries a derived status (open while any period is open, closed once all are) and period progress.',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listFiscalYears(@Req() request: Request & { user: RequestUser }) {
    return this.service.listFiscalYears(request.user.tenantId);
  }

  @Get('fiscal-years/:yearId')
  @ApiTags('Accounting - Fiscal Years')
  @ApiOperation({ summary: 'Get a fiscal year with its periods' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  getFiscalYear(
    @Param('yearId', ParseUUIDPipe) yearId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getFiscalYear(request.user.tenantId, yearId);
  }

  @Post('fiscal-years')
  @ApiTags('Accounting - Fiscal Years')
  @ApiOperation({
    summary: 'Generate a fiscal year and its 12 monthly periods',
    description:
      "Starts in the given month, or the tenant's configured fiscal year start month when none is sent. Rejected if any of the periods would overlap an existing one.",
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  generateFiscalYear(
    @Body() dto: GenerateFiscalYearDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.generateFiscalYear(
      request.user,
      dto.year,
      dto.startMonth,
    );
  }

  @Get('fiscal-periods')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'List tenant fiscal periods' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listFiscalPeriods(
    @Query() query: QueryFiscalPeriodsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listFiscalPeriods(request.user.tenantId, query);
  }

  @Post('fiscal-periods')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({
    summary:
      'Create a single non-overlapping fiscal period, or (with generateYear) the 12 monthly periods of a fiscal year',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createFiscalPeriod(
    @Body() dto: CreateFiscalPeriodDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createFiscalPeriod(request.user, dto);
  }

  @Get('fiscal-periods/:periodId/close-check')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({
    summary: 'Check what must be cleared before a period can be closed',
    description:
      'Blockers (earlier periods still open, draft journals, bills, invoices or cashbook ' +
      'entries dated in the period) stop the period leaving OPEN. Warnings (pending source ' +
      'events, bank accounts without a completed reconciliation) never do.',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  fiscalPeriodCloseCheck(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.fiscalPeriodCloseCheck(request.user.tenantId, periodId);
  }

  @Post('fiscal-periods/:periodId/open')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Reopen a soft-closed or closed fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  openFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.OPEN,
    );
  }

  @Post('fiscal-periods/:periodId/soft-close')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({
    summary: 'Soft close an open fiscal period',
    description:
      'The month-end review state. Runs the same pre-close check as close, and for now ' +
      'blocks posting exactly like a closed period.',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  softCloseFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.SOFT_CLOSED,
    );
  }

  @Post('fiscal-periods/:periodId/close')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Close an open or soft-closed fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  closeFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.CLOSED,
    );
  }

  @Post('fiscal-periods/:periodId/lock')
  @ApiTags('Accounting - Fiscal Periods')
  @ApiOperation({ summary: 'Permanently lock a fiscal period' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  lockFiscalPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.changeFiscalPeriodStatus(
      request.user,
      periodId,
      FiscalPeriodStatus.LOCKED,
    );
  }

  @Get('transaction-types')
  @ApiTags('Accounting - Transaction Types')
  @ApiOperation({ summary: 'List tenant transaction types' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listTransactionTypes(@Req() request: Request & { user: RequestUser }) {
    return this.service.listTransactionTypes(request.user);
  }

  @Post('transaction-types')
  @ApiTags('Accounting - Transaction Types')
  @ApiOperation({ summary: 'Create a transaction type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createTransactionType(
    @Body() dto: CreateTransactionTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createTransactionType(request.user, dto);
  }

  @Patch('transaction-types/:transactionTypeId')
  @ApiTags('Accounting - Transaction Types')
  @ApiOperation({ summary: 'Update a transaction type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateTransactionType(
    @Param('transactionTypeId', ParseUUIDPipe) transactionTypeId: string,
    @Body() dto: UpdateTransactionTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateTransactionType(
      request.user,
      transactionTypeId,
      dto,
    );
  }

  @Delete('transaction-types/:transactionTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Accounting - Transaction Types')
  @ApiOperation({ summary: 'Delete a transaction type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  deleteTransactionType(
    @Param('transactionTypeId', ParseUUIDPipe) transactionTypeId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteTransactionType(request.user, transactionTypeId);
  }

  @Post('transaction-types/seed-standard')
  @ApiTags('Accounting - Transaction Types')
  @ApiOperation({
    summary: 'Seed the standard cashbook transaction types for the tenant',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  seedStandardTransactionTypes(
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.seedStandardTransactionTypes(request.user);
  }
}
