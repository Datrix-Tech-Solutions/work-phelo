import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../../auth/guards/internal-service-auth.guard';
import { registrationFor } from '../source-transactions/source-registry';
import {
  CancelPaymentRequestDto,
  CreatePaymentRequestDto,
} from './dto/payment-request.dto';
import { PaymentRequestsService } from './payment-requests.service';

/** How another module tells Accounting a payer has paid an invoice, and withdraws a request. */
@ApiTags('Internal Payment Requests')
@Controller('internal/source-transactions/payment-requests')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalPaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Request that a payment be recorded against an invoice',
    description:
      'Nothing is posted: the request waits for an accountant, who chooses the bank and confirms. Needs a signed request that names the acting user.',
  })
  @ApiCreatedResponse({ description: 'The pending request.' })
  create(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: CreatePaymentRequestDto,
  ) {
    this.assertCaller(request, dto.sourceModule);
    return this.service.createFromSource(this.actingUser(request), dto);
  }

  @Post(':requestId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw a payment request that has not been acted on',
  })
  @ApiOkResponse({ description: 'The cancelled request.' })
  cancel(
    @Req() request: AuthenticatedInternalRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CancelPaymentRequestDto,
  ) {
    this.assertCaller(request, dto.sourceModule);
    return this.service.cancelFromSource(
      this.actingUser(request),
      requestId,
      dto,
    );
  }

  private actingUser(request: AuthenticatedInternalRequest): string {
    if (!request.internalActingUserId) {
      throw new ForbiddenException(
        'A signed request that names the acting user is required.',
      );
    }
    return request.internalActingUserId;
  }

  /** The allow-list admits any trusted service, so each module's routes are pinned to its own. */
  private assertCaller(
    request: AuthenticatedInternalRequest,
    sourceModule: string,
  ) {
    const registration = registrationFor(sourceModule);
    if (
      !registration ||
      request.internalServiceName !== registration.serviceName
    ) {
      throw new ForbiddenException(
        `Only ${registration?.serviceName ?? 'a registered service'} may act for ${sourceModule}.`,
      );
    }
  }
}
