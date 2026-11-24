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
import { ProjectAccountingEventDto } from '../dto/project-accounting-event.dto';
import { ProjectInvoicesService } from '../project-invoices.service';

const ACCOUNTING_SERVICE = 'accounting-service';

/** Accounting tells project management what happened to an invoice it was given. */
@ApiTags('Internal Accounting Events')
@Controller('internal/accounting-events')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalProjectAccountingEventsController {
  constructor(private readonly invoices: ProjectInvoicesService) {}

  @Post()
  @ApiOperation({
    summary: 'A project invoice was posted, reversed or rejected in Accounting',
    description:
      'Safe to send more than once, and answers handled: false for transactions project management did not raise.',
  })
  @ApiOkResponse({
    description: 'Whether the event matched a project invoice.',
  })
  handle(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: ProjectAccountingEventDto,
  ) {
    // The allow-list admits any trusted service, so pin this route to the one that may call it.
    if (request.internalServiceName !== ACCOUNTING_SERVICE) {
      throw new ForbiddenException(
        'Only accounting-service may send accounting events.',
      );
    }
    return this.invoices.handleAccountingEvent(dto);
  }
}
