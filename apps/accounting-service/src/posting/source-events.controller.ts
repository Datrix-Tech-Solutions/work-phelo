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
  ApiConflictResponse,
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
import { AccountingPermission } from '../ledger/accounting.permissions';
import { CreateSourceEventDto, QuerySourceEventsDto } from './dto/posting.dto';
import { SourceEventsService } from './source-events.service';

@Controller('source-events')
@ApiTags('Accounting - Source Events')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class SourceEventsController {
  constructor(private readonly service: SourceEventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Receive and process one idempotent operational source event',
    description:
      'Operational payloads remain module-neutral. Accounting resolves the active posting rule and atomically posts the resulting journal.',
  })
  @ApiConflictResponse({
    description: 'The tenant idempotency key already exists.',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_POST)
  receive(
    @Body() dto: CreateSourceEventDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.receive(request.user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the tenant source event inbox' })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  list(
    @Query() query: QuerySourceEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Get(':eventId')
  @ApiOperation({
    summary: 'Get source event status, failure, rule and journal linkage',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, eventId);
  }

  @Post(':eventId/retry')
  @ApiOperation({ summary: 'Retry a failed source event exactly once' })
  @ApiConflictResponse({
    description: 'The source event is not failed or is already processing.',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_POST)
  retry(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.retry(request.user, eventId);
  }
}
