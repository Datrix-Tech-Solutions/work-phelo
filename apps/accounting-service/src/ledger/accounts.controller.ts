import {
  Body,
  Controller,
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
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingPermission } from './accounting.permissions';
import {
  CreateAccountClassificationDto,
  CreateAccountGroupDto,
  CreateCostCentreDto,
  CreateGLAccountDto,
  CreateSubledgerAccountDto,
  QueryAccountGroupsDto,
  QueryAccountHierarchyDto,
  QueryGLAccountsDto,
  QuerySubledgerAccountsDto,
  UpdateAccountClassificationDto,
  UpdateAccountGroupDto,
  UpdateCostCentreDto,
  UpdateGLAccountDto,
  UpdateSubledgerAccountDto,
} from './dto/accounting.dto';
import { JournalsService } from './journals.service';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class AccountsController {
  constructor(
    private readonly masterData: AccountingMasterDataService,
    private readonly journals: JournalsService,
  ) {}

  @Get('account-categories')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'List system-controlled account categories' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listAccountCategories() {
    return this.masterData.listAccountCategories();
  }

  @Get('account-classifications')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'List tenant account classifications' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_VIEW)
  listAccountClassifications(
    @Query() query: QueryAccountHierarchyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listAccountClassifications(
      request.user.tenantId,
      query,
    );
  }

  @Post('account-classifications')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Create an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_CREATE)
  createAccountClassification(
    @Body() dto: CreateAccountClassificationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createAccountClassification(request.user, dto);
  }

  @Get('account-classifications/:classificationId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Get an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_VIEW)
  getAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Patch('account-classifications/:classificationId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Update an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_EDIT)
  updateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Body() dto: UpdateAccountClassificationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateAccountClassification(
      request.user,
      classificationId,
      dto,
    );
  }

  @Post('account-classifications/:classificationId/activate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Reactivate an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_EDIT)
  activateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Post('account-classifications/:classificationId/deactivate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Deactivate an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_DEACTIVATE)
  deactivateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Get('account-groups')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'List tenant account groups' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_VIEW)
  listAccountGroups(
    @Query() query: QueryAccountGroupsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listAccountGroups(request.user.tenantId, query);
  }

  @Post('account-groups')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Create an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_CREATE)
  createAccountGroup(
    @Body() dto: CreateAccountGroupDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createAccountGroup(request.user, dto);
  }

  @Get('account-groups/:groupId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Get an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_VIEW)
  getAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getAccountGroup(request.user, groupId);
  }

  @Patch('account-groups/:groupId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Update an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_EDIT)
  updateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateAccountGroupDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateAccountGroup(request.user, groupId, dto);
  }

  @Post('account-groups/:groupId/activate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Reactivate an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_EDIT)
  activateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateAccountGroup(request.user, groupId);
  }

  @Post('account-groups/:groupId/deactivate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Deactivate an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_DEACTIVATE)
  deactivateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateAccountGroup(request.user, groupId);
  }

  @Post('account-hierarchy/seed-standard')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({
    summary:
      'Seed a safe standard account classification and group hierarchy for a tenant',
  })
  @RequirePermissions(
    AccountingPermission.ACCOUNT_CLASSIFICATIONS_CREATE,
    AccountingPermission.ACCOUNT_GROUPS_CREATE,
  )
  seedStandardAccountHierarchy(
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.seedStandardAccountHierarchy(request.user);
  }

  @Get('accounts')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'List tenant GL accounts' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listAccounts(
    @Query() query: QueryGLAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listGLAccounts(request.user.tenantId, query);
  }

  @Post('accounts')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Create a tenant GL account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createAccount(
    @Body() dto: CreateGLAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createGLAccount(request.user, dto);
  }

  @Patch('accounts/:accountId')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Update a tenant GL account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateGLAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateGLAccount(request.user, accountId, dto);
  }

  @Post('accounts/:accountId/deactivate')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Deactivate a GL account without deleting history' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateGLAccount(request.user, accountId);
  }

  @Get('accounts/:accountId/ledger')
  @ApiTags('Accounting - General Ledger')
  @ApiOperation({ summary: 'Get posted ledger lines for one GL account' })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  accountLedger(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.journals.accountLedger(request.user.tenantId, accountId);
  }

  @Get('cost-centres')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'List tenant cost centres' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listCostCentres(@Req() request: Request & { user: RequestUser }) {
    return this.masterData.listCostCentres(request.user.tenantId);
  }

  @Post('cost-centres')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Create a tenant cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createCostCentre(
    @Body() dto: CreateCostCentreDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createCostCentre(request.user, dto);
  }

  @Patch('cost-centres/:costCentreId')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Update a tenant cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateCostCentre(
    @Param('costCentreId', ParseUUIDPipe) costCentreId: string,
    @Body() dto: UpdateCostCentreDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateCostCentre(request.user, costCentreId, dto);
  }

  @Post('cost-centres/:costCentreId/deactivate')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Deactivate a cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateCostCentre(
    @Param('costCentreId', ParseUUIDPipe) costCentreId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateCostCentre(request.user, costCentreId);
  }

  @Get('subledger-accounts')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({
    summary: 'List tenant subledger accounts',
    description:
      'Returns subledger balances by Accounting control account. The same legal counterparty may therefore appear in separate premium, claims, receivable or payable dimensions without netting across control accounts.',
  })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listSubledgers(
    @Query() query: QuerySubledgerAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listSubledgerAccounts(request.user.tenantId, query);
  }

  @Post('subledger-accounts')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Create a tenant subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createSubledger(
    @Body() dto: CreateSubledgerAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createSubledgerAccount(request.user, dto);
  }

  @Patch('subledger-accounts/:subledgerId')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Update a tenant subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateSubledger(
    @Param('subledgerId', ParseUUIDPipe) subledgerId: string,
    @Body() dto: UpdateSubledgerAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateSubledgerAccount(
      request.user,
      subledgerId,
      dto,
    );
  }

  @Post('subledger-accounts/:subledgerId/deactivate')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Deactivate a subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateSubledger(
    @Param('subledgerId', ParseUUIDPipe) subledgerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateSubledgerAccount(
      request.user,
      subledgerId,
    );
  }

  @Post('subledger-accounts/:subledgerId/activate')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Reactivate a subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  activateSubledger(
    @Param('subledgerId', ParseUUIDPipe) subledgerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateSubledgerAccount(request.user, subledgerId);
  }
}
