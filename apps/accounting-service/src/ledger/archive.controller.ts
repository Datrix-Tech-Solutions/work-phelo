import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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
import { ArchiveService } from './archive.service';
import { QueryArchiveDto } from './dto/archive.dto';

@Controller('archive')
@ApiTags('Accounting - Archive')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class ArchiveController {
  constructor(private readonly service: ArchiveService) {}

  @Get()
  @ApiOperation({
    summary: 'List voided entries of every kind',
    description:
      'Voided journals, transactions, invoices, bills, notes, receipts and payments, newest void first. They count in no balance or report.',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  list(
    @Query() query: QueryArchiveDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }
}
