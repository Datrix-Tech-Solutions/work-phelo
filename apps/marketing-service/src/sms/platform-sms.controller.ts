import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { TenantMarketingEnabledGuard } from '../auth/guards/tenant-marketing-enabled.guard';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  CreateSmsSenderIdentityDto,
  GrantSmsCreditsDto,
  QuerySmsLedgerDto,
  QuerySmsSenderIdentitiesDto,
  ReconcileSmsSenderProviderStatusDto,
  UpdateSmsSenderIdentityDto,
} from './dto/sms-sender-identity.dto';
import { SmsSenderIdentitiesService } from './sms-sender-identities.service';
import { SmsWalletService } from './sms-wallet.service';

type AuthedRequest = Request & { user: RequestUser };

/**
 * The same actor, acting inside the tenant being provisioned. The services scope every query by
 * the actor's tenant, so this is how a platform administrator reaches another tenant's records
 * without a second copy of their rules. Role and identity are untouched, so the super-admin
 * checks inside the services still apply.
 */
function actingIn(user: RequestUser, tenantId: string): RequestUser {
  return { ...user, tenantId };
}

/**
 * Platform administrators provisioning a tenant's SMS sender IDs and wallet. Not behind
 * ModuleGuard, which checks the caller's own tenant's modules; TenantMarketingEnabledGuard checks
 * the tenant being configured instead.
 */
@Controller('platform/tenants/:tenantId/sms')
@ApiTags('Marketing - Platform SMS Provisioning')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'tenantId', format: 'uuid' })
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Only platform administrators can use these endpoints.',
})
@UseGuards(JwtAuthGuard, SuperAdminGuard, TenantMarketingEnabledGuard)
export class PlatformSmsController {
  constructor(
    private readonly senders: SmsSenderIdentitiesService,
    private readonly wallet: SmsWalletService,
  ) {}

  @Get('sender-identities')
  @ApiOperation({ summary: 'List a tenant’s SMS sender identities' })
  listSenders(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: QuerySmsSenderIdentitiesDto,
  ) {
    return this.senders.list(tenantId, query);
  }

  @Post('sender-identities')
  @ApiOperation({
    summary: 'Create an approved SMS sender identity for a tenant',
    description:
      'The platform is the approver, so the identity can be used by campaigns immediately.',
  })
  createSender(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateSmsSenderIdentityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.createApproved(tenantId, request.user.id, dto);
  }

  @Patch('sender-identities/:id')
  @ApiOperation({
    summary: 'Update a draft or rejected SMS sender identity of a tenant',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateSender(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSmsSenderIdentityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.update(actingIn(request.user, tenantId), id, dto);
  }

  @Delete('sender-identities/:id')
  @ApiOperation({ summary: 'Archive a tenant’s SMS sender identity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archiveSender(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.archive(actingIn(request.user, tenantId), id);
  }

  @Post('sender-identities/:id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set an approved SMS sender identity as the tenant default',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  setDefaultSender(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.setDefault(actingIn(request.user, tenantId), id);
  }

  @Post('sender-identities/:id/refresh-provider-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh a tenant sender identity provider status when supported',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  refreshProviderStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.refreshProviderStatus(
      actingIn(request.user, tenantId),
      id,
    );
  }

  @Post('sender-identities/:id/provider-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Record externally confirmed provider status for a tenant sender identity',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  reconcileProviderStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileSmsSenderProviderStatusDto,
    @Req() request: AuthedRequest,
  ) {
    return this.senders.reconcileProviderStatus(
      actingIn(request.user, tenantId),
      id,
      dto,
    );
  }

  @Get('wallet')
  @ApiOperation({ summary: 'Get a tenant’s SMS credit wallet balance' })
  getBalance(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.wallet.getBalance(tenantId);
  }

  @Get('wallet/ledger')
  @ApiOperation({ summary: 'List a tenant’s SMS credit ledger entries' })
  listLedger(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: QuerySmsLedgerDto,
  ) {
    return this.wallet.listLedger(tenantId, query);
  }

  @Post('wallet/grants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant SMS credits to a tenant' })
  grant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: GrantSmsCreditsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.wallet.grantCredits(actingIn(request.user, tenantId), dto);
  }
}
