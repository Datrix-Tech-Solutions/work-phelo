import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
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
} from '@work-phelo/internal-auth';
import { ClientBillingService } from './client-billing.service';
import { AccountingEventDto } from './dto/billing.dto';

const ACCOUNTING_SERVICE = 'accounting-service';

/** Accounting tells marketing what happened to a transaction it was given. */
@ApiTags('Internal Accounting Events')
@Controller('internal/accounting-events')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalAccountingEventsController {
  constructor(private readonly billing: ClientBillingService) {}

  @Post()
  @ApiOperation({
    summary:
      'A billing transaction was posted, reversed or rejected in Accounting',
    description:
      'Moves the product the transaction was raised for between Pending and Purchased. Safe to send more than once, and answers handled: false for transactions marketing did not raise.',
  })
  @ApiOkResponse({
    description: 'Whether the event matched a marketing transaction.',
  })
  handle(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: AccountingEventDto,
  ) {
    // The allow-list admits any trusted service, so pin this route to the one that may call it.
    if (request.internalServiceName !== ACCOUNTING_SERVICE) {
      throw new ForbiddenException(
        'Only accounting-service may send accounting events.',
      );
    }
    return this.billing.handleAccountingEvent(dto);
  }
}
