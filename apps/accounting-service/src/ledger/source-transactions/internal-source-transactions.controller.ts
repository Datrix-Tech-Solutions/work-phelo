import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
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
import {
  CreateSourceTransactionDto,
  ListSourceTransactionsQueryDto,
  ReceiptsSummaryDto,
  SourceTransactionsQueryDto,
} from './dto/source-transaction.dto';
import { SourceTransactionsService } from './source-transactions.service';
import { registrationFor } from './source-registry';

/**
 * How another module raises transactions in Accounting for its own records. Each module is
 * described once in the source registry; this controller serves them all.
 */
@ApiTags('Internal Source Transactions')
@Controller('internal/source-transactions')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalSourceTransactionsController {
  constructor(private readonly service: SourceTransactionsService) {}

  @Get('options')
  @ApiOperation({
    summary:
      'Whether a module can raise transactions, and what its form offers',
    description:
      'Provisions the module’s source and default entity type if they do not exist yet. A new source starts unlinked, so this answers ready: false until an accountant links it.',
  })
  @ApiOkResponse({
    description:
      'Readiness, base currency, entity types and transaction types.',
  })
  options(
    @Req() request: AuthenticatedInternalRequest,
    @Query() query: SourceTransactionsQueryDto,
  ) {
    this.assertCaller(request, query.sourceModule);
    return this.service.getOptions(query.tenantId, query.sourceModule);
  }

  @Post()
  @ApiOperation({
    summary: 'Raise a transaction for a module’s record',
    description:
      'Creates the record’s entity the first time, then a draft the accountant completes and posts. Needs a signed request carrying the acting user, so the draft shows who raised it.',
  })
  @ApiCreatedResponse({
    description: 'The entity, its type, and the transaction.',
  })
  create(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: CreateSourceTransactionDto,
  ) {
    this.assertCaller(request, dto.sourceModule);
    if (!request.internalActingUserId) {
      throw new ForbiddenException(
        'A signed request that names the acting user is required to raise a transaction.',
      );
    }
    return this.service.create(request.internalActingUserId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'The transactions of an entity, with their current state',
  })
  @ApiOkResponse({ description: 'A page of transactions.' })
  list(
    @Req() request: AuthenticatedInternalRequest,
    @Query() query: ListSourceTransactionsQueryDto,
  ) {
    this.assertCaller(request, query.sourceModule);
    return this.service.list(query);
  }

  @Post('receipts-summary')
  @ApiOperation({
    summary: 'Money received for entities, and against specific transactions',
  })
  @ApiOkResponse({ description: 'Received totals in the base currency.' })
  receiptsSummary(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: ReceiptsSummaryDto,
  ) {
    this.assertCaller(request, dto.sourceModule);
    return this.service.receiptsSummary(dto);
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
