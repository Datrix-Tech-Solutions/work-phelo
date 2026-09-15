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
  CreateTaxTypeDto,
  CreateTransactionTypeRuleDto,
  UpdateTaxTypeDto,
  UpdateTransactionTypeRuleDto,
} from './dto/transaction-type-rules.dto';
import { TransactionTypeRulesService } from './transaction-type-rules.service';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class TransactionTypeRulesController {
  constructor(private readonly service: TransactionTypeRulesService) {}

  @Get('tax-types')
  @ApiTags('Accounting - Tax Types')
  @ApiOperation({ summary: 'List tenant tax types' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listTaxTypes(@Req() request: Request & { user: RequestUser }) {
    return this.service.listTaxTypes(request.user.tenantId);
  }

  @Post('tax-types')
  @ApiTags('Accounting - Tax Types')
  @ApiOperation({ summary: 'Create a tax type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createTaxType(
    @Body() dto: CreateTaxTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createTaxType(request.user, dto);
  }

  @Patch('tax-types/:taxTypeId')
  @ApiTags('Accounting - Tax Types')
  @ApiOperation({ summary: 'Update a tax type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateTaxType(
    @Param('taxTypeId', ParseUUIDPipe) taxTypeId: string,
    @Body() dto: UpdateTaxTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateTaxType(request.user, taxTypeId, dto);
  }

  @Delete('tax-types/:taxTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Accounting - Tax Types')
  @ApiOperation({ summary: 'Delete a tax type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  deleteTaxType(
    @Param('taxTypeId', ParseUUIDPipe) taxTypeId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteTaxType(request.user, taxTypeId);
  }

  @Get('transaction-type-rules')
  @ApiTags('Accounting - Transaction Type Rules')
  @ApiOperation({ summary: 'List tenant transaction type rules' })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  listRules(@Req() request: Request & { user: RequestUser }) {
    return this.service.listRules(request.user.tenantId);
  }

  @Post('transaction-type-rules')
  @ApiTags('Accounting - Transaction Type Rules')
  @ApiOperation({ summary: 'Create a transaction type rule' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  createRule(
    @Body() dto: CreateTransactionTypeRuleDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createRule(request.user, dto);
  }

  @Patch('transaction-type-rules/:ruleId')
  @ApiTags('Accounting - Transaction Type Rules')
  @ApiOperation({ summary: 'Update a transaction type rule' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  updateRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateTransactionTypeRuleDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateRule(request.user, ruleId, dto);
  }

  @Delete('transaction-type-rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Accounting - Transaction Type Rules')
  @ApiOperation({ summary: 'Delete a transaction type rule' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  deleteRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteRule(request.user, ruleId);
  }
}
