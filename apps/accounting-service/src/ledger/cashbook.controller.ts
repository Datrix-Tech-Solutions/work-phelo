import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ACCOUNTING_REFERENCE_READERS,
  AccountingPermission,
} from './accounting.permissions';
import { CashbookService } from './cashbook.service';
import { VoidEntryDto } from './dto/accounting.dto';
import {
  EditPostedCashbookDto,
  RejectDraftDto,
  UpdateCashbookDraftDto,
} from './dto/draft-actions.dto';
import {
  CreateCashAccountDto,
  CreateCashbookAdjustmentDto,
  CreateCashbookChargeDto,
  CreateCashbookPaymentDto,
  CreateCashbookReceiptDto,
  CreateCashbookTransferDto,
  QueryCashAccountsDto,
  QueryCashbookDto,
  ReverseCashbookTransactionDto,
  UpdateCashAccountDto,
} from './dto/cashbook.dto';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class CashbookController {
  constructor(private readonly service: CashbookService) {}

  @Get('cash-accounts')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'List tenant cash, bank and wallet accounts',
    description:
      'Returns Accounting-owned cash account masters. These are linked to active, posting-enabled GL asset accounts and are independent of source modules.',
  })
  @RequireAnyPermission(...ACCOUNTING_REFERENCE_READERS)
  listCashAccounts(
    @Query() query: QueryCashAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCashAccounts(request.user.tenantId, query);
  }

  @Post('cash-accounts')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'Create a tenant cash, bank or wallet account',
    description:
      'Creates a non-secret cash account master. Account identifiers should be masked; credentials and raw secrets must not be stored.',
  })
  @ApiConflictResponse({
    description: 'A cash account with this name or identifier already exists.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_MANAGE)
  createCashAccount(
    @Body() dto: CreateCashAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCashAccount(request.user, dto);
  }

  @Get('cash-accounts/:cashAccountId')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({ summary: 'Get a tenant cash account' })
  @RequireAnyPermission(...ACCOUNTING_REFERENCE_READERS)
  getCashAccount(
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCashAccount(request.user, cashAccountId);
  }

  @Patch('cash-accounts/:cashAccountId')
  @ApiTags('Accounting - Cash Accounts')
  @ApiOperation({
    summary: 'Update or deactivate a tenant cash account',
    description:
      'Inactive cash accounts remain historical but cannot receive new cashbook transactions.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_MANAGE)
  updateCashAccount(
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Body() dto: UpdateCashAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    const user = request.user;
    const admin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN';
    // Activating or deactivating an account is its own permission, apart from managing it.
    if (
      dto.isActive !== undefined &&
      !admin &&
      !user.permissions.includes(AccountingPermission.CASH_ACCOUNTS_DEACTIVATE)
    ) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }
    return this.service.updateCashAccount(user, cashAccountId, dto);
  }

  @Get('cashbook')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'List tenant cashbook transactions',
    description:
      'Paginated read model for standalone Accounting cashbook transactions with filters for account, date range, type, status and currency.',
  })
  @RequireAnyPermission(
    AccountingPermission.TRANSACTIONS_VIEW,
    AccountingPermission.CASH_ACCOUNTS_VIEW,
  )
  listCashbook(
    @Query() query: QueryCashbookDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listCashbook(request.user.tenantId, query);
  }

  @Get('cashbook/:transactionId')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({ summary: 'Get a cashbook transaction with journal linkage' })
  @RequireAnyPermission(
    AccountingPermission.TRANSACTIONS_VIEW,
    AccountingPermission.CASH_ACCOUNTS_VIEW,
  )
  getCashbookTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getCashbookTransaction(request.user, transactionId);
  }

  @Post('cashbook/receipts')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft manual cashbook receipt',
    description:
      'Posting debits the selected cash account GL account and credits the selected offset account.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_CREATE)
  createReceipt(
    @Body() dto: CreateCashbookReceiptDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createReceipt(request.user, dto);
  }

  @Post('cashbook/payments')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft manual cashbook payment',
    description:
      'Posting debits the selected offset account and credits the selected cash account GL account.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_CREATE)
  createPayment(
    @Body() dto: CreateCashbookPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createPayment(request.user, dto);
  }

  @Post('cashbook/transfers')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft transfer between tenant cash accounts',
    description:
      'Posting debits the destination cash account GL account and credits the source cash account GL account. Cross-currency transfers require an agreed exchange rate; no live FX lookup is performed.',
  })
  @RequirePermissions(AccountingPermission.CASH_ACCOUNTS_MANAGE)
  createTransfer(
    @Body() dto: CreateCashbookTransferDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createTransfer(request.user, dto);
  }

  @Post('cashbook/charges')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft standalone bank charge',
    description:
      'Posting debits the selected expense/offset account and credits the affected cash account.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_CREATE)
  createCharge(
    @Body() dto: CreateCashbookChargeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createCharge(request.user, dto);
  }

  @Post('cashbook/adjustments')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Create a draft cashbook adjustment',
    description:
      'Adjustments can increase or reduce the selected cash account. Corrections to posted entries should use reversal plus a new adjustment.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_CREATE)
  createAdjustment(
    @Body() dto: CreateCashbookAdjustmentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createAdjustment(request.user, dto);
  }

  @Patch('cashbook/:transactionId')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Complete a draft direct receipt or payment',
    description:
      'Changes the date, cash account, settlement method, account and references of a draft. The amount, quantity and unit price are fixed when it is raised and cannot be changed.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_CREATE)
  updateDraftTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: UpdateCashbookDraftDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateDraftTransaction(
      request.user,
      transactionId,
      dto,
    );
  }

  @Delete('cashbook/:transactionId')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Delete a draft direct receipt, payment or transfer',
    description:
      'Removes the draft for good. Posted entries are immutable. An entry raised by another module is rejected instead.',
  })
  @RequireAnyPermission(
    AccountingPermission.TRANSACTIONS_POST,
    AccountingPermission.CASH_ACCOUNTS_MANAGE,
  )
  deleteDraftTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteDraftTransaction(request.user, transactionId);
  }

  @Patch('cashbook/:transactionId/posted')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Edit a posted receipt, payment or contra transaction',
    description:
      'Allowed while the entry’s fiscal period is open. The entry keeps its number and its journal is rewritten.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_POST)
  editPostedTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: EditPostedCashbookDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.editPostedTransaction(request.user, transactionId, dto);
  }

  @Post('cashbook/:transactionId/void')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Void a posted cashbook entry while its period is open',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_VOID)
  voidPostedTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: VoidEntryDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.voidPostedTransaction(request.user, transactionId, dto);
  }

  @Post('cashbook/:transactionId/restore')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Restore a voided cashbook entry, optionally with corrections',
  })
  @RequirePermissions(AccountingPermission.ARCHIVE_RESTORE)
  restoreVoidedTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: EditPostedCashbookDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.restoreVoidedTransaction(
      request.user,
      transactionId,
      dto,
    );
  }

  @Post('cashbook/:transactionId/reject')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Reject a draft direct receipt or payment',
    description:
      'Marks the draft REJECTED with a reason. It never posts, keeps its record, and the module that raised it is told.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_POST)
  rejectTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: RejectDraftDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.rejectTransaction(request.user, transactionId, dto);
  }

  @Post('cashbook/:transactionId/post')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Post a draft cashbook transaction',
    description:
      'Atomically creates a balanced posted journal and marks the cashbook transaction POSTED. Duplicate posting is rejected.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_POST)
  postTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.postTransaction(request.user, transactionId);
  }

  @Post('cashbook/:transactionId/reverse')
  @ApiTags('Accounting - Cashbook')
  @ApiOperation({
    summary: 'Reverse a posted cashbook transaction',
    description:
      'Creates an immutable linked reversal cashbook row and a reversing posted journal. Posted transaction facts are not edited.',
  })
  @RequirePermissions(AccountingPermission.TRANSACTIONS_REVERSE)
  reverseTransaction(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: ReverseCashbookTransactionDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reverseTransaction(request.user, transactionId, dto);
  }
}
