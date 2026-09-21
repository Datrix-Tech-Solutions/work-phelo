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
import { AccountingPermission } from './accounting.permissions';
import {
  CreateRecurringJournalDto,
  QueryRecurringJournalsDto,
  UpdateRecurringJournalDto,
} from './dto/accounting.dto';
import { RecurringJournalsService } from './recurring-journals.service';

type AuthedRequest = Request & { user: RequestUser };

@Controller('recurring-journals')
@ApiTags('Accounting - Recurring Journals')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class RecurringJournalsController {
  constructor(private readonly service: RecurringJournalsService) {}

  @Get()
  @ApiOperation({ summary: 'List recurring journal entries' })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  list(
    @Query() query: QueryRecurringJournalsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a recurring journal entry that generates a journal on a schedule',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_CREATE)
  create(
    @Body() dto: CreateRecurringJournalDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring journal entry and its lines' })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an active or paused recurring entry' })
  @RequirePermissions(AccountingPermission.JOURNALS_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringJournalDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring entry' })
  @RequirePermissions(AccountingPermission.JOURNALS_EDIT)
  pause(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthedRequest) {
    return this.service.pause(request.user, id);
  }

  @Post(':id/resume')
  @ApiOperation({
    summary:
      'Resume a paused recurring entry; runs missed while paused are skipped',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_EDIT)
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.resume(request.user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a recurring entry for good' })
  @RequirePermissions(AccountingPermission.JOURNALS_EDIT)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.cancel(request.user, id);
  }

  @Post(':id/run-now')
  @ApiOperation({
    summary: 'Generate the next scheduled journal now and advance the schedule',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_POST)
  runNow(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.runNow(request.user, id);
  }
}
