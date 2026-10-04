import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { RequireModule } from '../../auth/decorators/module.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AccountingPermission } from '../accounting.permissions';
import { RejectDraftDto } from '../dto/draft-actions.dto';
import {
  CompletePaymentRequestDto,
  QueryPaymentRequestsDto,
} from './dto/payment-request.dto';
import { PaymentRequestsService } from './payment-requests.service';

/** Payments another module says were made against an invoice, waiting for an accountant to confirm. */
@Controller('receivables')
@ApiTags('Accounting - Payment Requests')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class PaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  @Get('payment-requests')
  @ApiOperation({
    summary: 'List payment requests (pending ones by default)',
    description:
      'Requests another module raised against a posted invoice and an accountant has not yet confirmed, rejected or had withdrawn.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  list(
    @Query() query: QueryPaymentRequestsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Get('invoices/:invoiceId/payment-requests')
  @ApiOperation({
    summary: "An invoice's payment requests, whatever became of them",
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_VIEW)
  listForInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listForInvoice(request.user.tenantId, invoiceId);
  }

  @Post('payment-requests/:requestId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a payment request: receive the payment',
    description:
      'Creates the receipt for the chosen cash/bank account, posts it and allocates it to the invoice. If a step fails the request stays pending with the receipt so far, and completing again carries on from there.',
  })
  @RequirePermissions(
    AccountingPermission.RECEIVABLES_CREATE,
    AccountingPermission.RECEIVABLES_POST,
    AccountingPermission.RECEIVABLES_ALLOCATE,
  )
  complete(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CompletePaymentRequestDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.complete(request.user, requestId, dto);
  }

  @Post('payment-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a payment request',
    description:
      'Marks the request REJECTED with a reason. Its amount is released, and whoever raised it sees the reason.',
  })
  @RequirePermissions(AccountingPermission.RECEIVABLES_POST)
  reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectDraftDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.reject(request.user, requestId, dto.reason);
  }
}
