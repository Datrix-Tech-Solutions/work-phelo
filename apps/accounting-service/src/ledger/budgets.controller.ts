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
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from './accounting.permissions';
import { BudgetsService } from './budgets.service';
import {
  CreateBudgetDto,
  QueryBudgetsDto,
  UpdateBudgetDto,
} from './dto/budgets.dto';

@Controller('budgets')
@ApiTags('Accounting - Budgets')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a draft budget',
    description:
      'Creates a budget in the tenant base currency. Each line targets a leaf expense or revenue ' +
      'account, optionally split by cost centre. The end date is derived from period and start date.',
  })
  @RequirePermissions(AccountingPermission.BUDGETS_CREATE)
  create(
    @Body() dto: CreateBudgetDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List budgets',
    description:
      'Returns every matching budget with its income, expense and net totals — no per-line detail.',
  })
  @RequirePermissions(AccountingPermission.BUDGETS_VIEW)
  list(
    @Query() query: QueryBudgetsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Get(':budgetId')
  @ApiOperation({
    summary: 'Get a budget with per-line actuals',
    description:
      'Each line carries its budgeted amount and the actual posted over the budget window ' +
      '(base currency; revenue as credit − debit, expense as debit − credit). ' +
      '`actual` is null until the line has posted activity. A company-wide line reads the ' +
      "account's activity across all cost centres.",
  })
  @RequirePermissions(AccountingPermission.BUDGETS_VIEW)
  get(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.get(request.user.tenantId, budgetId);
  }

  @Patch(':budgetId')
  @ApiOperation({
    summary: 'Update a draft or active budget',
    description:
      'Any subset of the create fields. When `lines` is sent it replaces the budget lines. ' +
      'Closed budgets cannot be edited.',
  })
  @RequirePermissions(AccountingPermission.BUDGETS_EDIT)
  update(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Body() dto: UpdateBudgetDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, budgetId, dto);
  }

  @Post(':budgetId/activate')
  @ApiOperation({ summary: 'Activate a draft budget' })
  @RequirePermissions(AccountingPermission.BUDGETS_ACTIVATE)
  activate(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.activate(request.user, budgetId);
  }

  @Post(':budgetId/close')
  @ApiOperation({ summary: 'Close an active budget' })
  @RequirePermissions(AccountingPermission.BUDGETS_ACTIVATE)
  close(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.close(request.user, budgetId);
  }

  @Delete(':budgetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft budget' })
  @RequirePermissions(AccountingPermission.BUDGETS_DELETE)
  remove(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.remove(request.user, budgetId);
  }
}
