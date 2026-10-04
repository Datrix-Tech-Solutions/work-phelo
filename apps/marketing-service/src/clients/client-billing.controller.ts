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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { ClientBillingService } from './client-billing.service';
import {
  QueryClientBillingDto,
  RaiseClientBillingDto,
} from './dto/billing.dto';

const { CLIENTS_VIEW, CLIENTS_BILLING_VIEW, CLIENTS_BILLING_CREATE } =
  MarketingCrmSettingsPermission;

/**
 * Billing for clients: marketing tells Accounting about a transaction, and Accounting owns it from
 * there. Registered before ClientsController so `clients/billing/options` is not read as a client id.
 */
@Controller('clients')
@ApiTags('Marketing - Client Billing')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or billing permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ClientBillingController {
  constructor(private readonly service: ClientBillingService) {}

  @Get('billing/options')
  @RequireAnyPermission(CLIENTS_VIEW)
  @ApiOperation({
    summary: 'Whether clients can be billed, and what the billing form offers',
    description:
      'Asks Accounting for the entity types, transaction types and base currency linked to the marketing source. When Accounting is not set up this answers ready: false instead of failing, so the Billable toggle can be disabled with a message.',
  })
  @ApiOkResponse({ description: 'Billing readiness and form options.' })
  options(@Req() request: Request & { user: RequestUser }) {
    return this.service.getOptions(request.user);
  }

  @Get(':id/billing/transactions')
  @RequireAnyPermission(CLIENTS_BILLING_VIEW)
  @ApiOperation({
    summary:
      "A client's billing transactions, with state read live from Accounting",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'A page of the client’s transactions.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  transactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryClientBillingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listTransactions(request.user, id, query);
  }

  @Get(':id/billing/summary')
  @RequireAnyPermission(CLIENTS_BILLING_VIEW)
  @ApiOperation({
    summary: "A client's achieved revenue, in total and per product",
    description:
      'Achieved revenue is what Accounting has received. The per-product figure covers the transactions raised for that product from marketing.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Achieved revenue.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  summary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getSummary(request.user, id);
  }

  @Post(':id/billing')
  @RequireAnyPermission(CLIENTS_BILLING_CREATE)
  @ApiOperation({
    summary: 'Raise a billing transaction for a client',
    description:
      "Sends the transaction to Accounting, which creates the client's entity (first transaction only) and the draft. Billing is switched on for the client by its first transaction. Sending the same submissionId again does not create a second one.",
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'The recorded transaction.' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  raise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RaiseClientBillingDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.raise(request.user, id, dto);
  }
}
