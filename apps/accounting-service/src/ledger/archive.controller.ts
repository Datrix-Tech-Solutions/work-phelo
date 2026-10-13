import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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

/** What it takes to delete each kind: the same permission that voids and restores it. */
const DELETE_PERMISSION: Record<ArchiveKind, string> = {
  JOURNAL: AccountingPermission.JOURNALS_POST,
  CASHBOOK: AccountingPermission.CASHBOOK_POST,
  INVOICE: AccountingPermission.RECEIVABLES_POST,
  CREDIT_NOTE: AccountingPermission.RECEIVABLES_POST,
  RECEIPT: AccountingPermission.RECEIVABLES_POST,
  BILL: AccountingPermission.PAYABLES_POST,
  DEBIT_NOTE: AccountingPermission.PAYABLES_POST,
  PAYMENT: AccountingPermission.PAYABLES_POST,
};

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

  @Post('delete')
  @ApiOperation({
    summary: 'Delete several archived entries',
    description:
      'Removes voided entries from the archive for good. Entries no longer in the archive are skipped.',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  deleteMany(
    @Body() dto: DeleteArchivedEntriesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    const user = request.user;
    const admin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN';
    if (!admin) {
      const missing = dto.items.some(
        (item) => !user.permissions.includes(DELETE_PERMISSION[item.kind]),
      );
      if (missing) {
        throw new ForbiddenException(
          "You don't have permission to access this. Contact your administrator.",
        );
      }
    }
    return this.service.deleteArchivedMany(user, dto.items);
  }

  @Delete(':kind/:id')
  @ApiOperation({
    summary: 'Delete an archived entry',
    description:
      'Removes a voided entry from the archive for good. The record and its audit trail are kept; it is no longer listed.',
  })
  @RequirePermissions(AccountingPermission.JOURNALS_VIEW)
  delete(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    if (!(ARCHIVE_KINDS as readonly string[]).includes(kind)) {
      throw new NotFoundException('Unknown archive entry type');
    }
    const user = request.user;
    const needed = DELETE_PERMISSION[kind as ArchiveKind];
    const admin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN';
    if (!admin && !user.permissions.includes(needed)) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }
    return this.service.deleteArchived(user, kind as ArchiveKind, id);
  }
}
