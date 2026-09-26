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
  MakeSourceLedgerPaymentDto,
  QuerySourceLedgerDto,
} from './dto/source-ledger.dto';
import { SourceLedgerService } from './source-ledger.service';

@Controller('source-ledger')
@ApiTags('Accounting - Source Ledger')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class SourceLedgerController {
  constructor(private readonly service: SourceLedgerService) {}

  @Get()
  @ApiOperation({
    summary: 'List posted, source-linked open items awaiting settlement',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_VIEW)
  list(
    @Query() query: QuerySourceLedgerDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user, query);
  }

  @Post(':entryId/payments')
  @ApiOperation({
    summary: 'Record a payment against a source ledger entry',
    description:
      'Creates and posts an ordinary cashbook Payment (one journal entry) and records the ' +
      'allocation against this entry in the same action.',
  })
  @RequirePermissions(AccountingPermission.CASHBOOK_CREATE)
  makePayment(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: MakeSourceLedgerPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.makePayment(request.user, entryId, dto);
  }
}
