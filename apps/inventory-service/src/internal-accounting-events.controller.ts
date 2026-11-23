import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '@work-phelo/internal-auth';
import { InventoryService } from './inventory.service';

const ACCOUNTING_SERVICE = 'accounting-service';

export class AccountingEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;
  @ApiProperty({ example: 'OPERATIONS' })
  @IsString()
  sourceModule!: string;
  @ApiProperty({ description: "Accounting's id for the transaction." })
  @IsString()
  @MaxLength(100)
  transactionId!: string;
  @ApiProperty({ enum: ['POSTED', 'REVERSED', 'REJECTED'] })
  @IsEnum(['POSTED', 'REVERSED', 'REJECTED'])
  event!: 'POSTED' | 'REVERSED' | 'REJECTED';
}

/** Accounting tells inventory what happened to a payment it was given. */
@ApiTags('Internal Accounting Events')
@Controller('internal/accounting-events')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalAccountingEventsController {
  constructor(private readonly service: InventoryService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'A supplier payment was posted, reversed or rejected in Accounting',
    description:
      'A rejection stops the payment counting as paid. Posting and reversing change nothing here. Safe to send more than once.',
  })
  @ApiOkResponse({ description: 'Whether the event matched a payment inventory raised.' })
  handle(@Req() request: AuthenticatedInternalRequest, @Body() dto: AccountingEventDto) {
    // The allow-list admits any trusted service, so pin this route to the one that may call it.
    if (request.internalServiceName !== ACCOUNTING_SERVICE)
      throw new ForbiddenException('Only accounting-service may send accounting events.');
    return this.service.handleAccountingEvent(dto);
  }
}
