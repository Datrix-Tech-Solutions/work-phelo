import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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
import { ArchiveKind, ArchiveService } from './archive.service';
import {
  ARCHIVE_KINDS,
  DeleteArchivedEntriesDto,
  QueryArchiveDto,
} from './dto/archive.dto';

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
  @RequirePermissions(AccountingPermission.ARCHIVE_VIEW)
  list(
    @Query() query: QueryArchiveDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post('delete')
  @ApiOperation({
    summary: 'Delete several archived entries',
    description:
      'Removes voided entries from the archive for good. Entries no longer in the archive are skipped.',
  })
  @RequirePermissions(AccountingPermission.ARCHIVE_DELETE)
  deleteMany(
    @Body() dto: DeleteArchivedEntriesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteArchivedMany(request.user, dto.items);
  }

  @Delete(':kind/:id')
  @ApiOperation({
    summary: 'Delete an archived entry',
    description:
      'Removes a voided entry from the archive for good. The record and its audit trail are kept; it is no longer listed.',
  })
  @RequirePermissions(AccountingPermission.ARCHIVE_DELETE)
  delete(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    if (!(ARCHIVE_KINDS as readonly string[]).includes(kind)) {
      throw new NotFoundException('Unknown archive entry type');
    }
    return this.service.deleteArchived(request.user, kind as ArchiveKind, id);
  }
}
