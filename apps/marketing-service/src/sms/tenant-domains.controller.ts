import {
  Body,
  Controller,
  Delete,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  CreateTenantDomainDto,
  QueryTenantDomainsDto,
  TenantDomainResponseDto,
  TenantDomainsListResponseDto,
  TenantDomainVerificationResponseDto,
} from './dto/tenant-domain.dto';
import { TenantDomainsService } from './tenant-domains.service';

type AuthedRequest = Request & { user: RequestUser };

const { DOMAINS_VIEW, DOMAINS_CREATE, DOMAINS_VERIFY, DOMAINS_DELETE } =
  MarketingCrmSettingsPermission;

@Controller('settings/domains')
@ApiTags('Marketing - Business Domains')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or domain permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class TenantDomainsController {
  constructor(private readonly service: TenantDomainsService) {}

  @Get()
  @RequireAnyPermission(DOMAINS_VIEW)
  @ApiOperation({ summary: 'List tenant business domains' })
  @ApiOkResponse({ type: TenantDomainsListResponseDto })
  list(@Query() query: QueryTenantDomainsDto, @Req() request: AuthedRequest) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @RequireAnyPermission(DOMAINS_CREATE)
  @ApiOperation({ summary: 'Register a tenant business domain' })
  @ApiCreatedResponse({ type: TenantDomainResponseDto })
  create(@Body() dto: CreateTenantDomainDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Get(':id')
  @RequireAnyPermission(DOMAINS_VIEW)
  @ApiOperation({ summary: 'Get a tenant business domain' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantDomainResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(DOMAINS_VERIFY)
  @ApiOperation({
    summary: 'Verify a tenant business domain DNS TXT challenge',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantDomainVerificationResponseDto })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.verify(request.user, id);
  }

  @Post(':id/regenerate-verification')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(DOMAINS_VERIFY)
  @ApiOperation({ summary: 'Regenerate a business domain DNS TXT challenge' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantDomainResponseDto })
  regenerateVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.regenerateVerification(request.user, id);
  }

  @Delete(':id')
  @RequireAnyPermission(DOMAINS_DELETE)
  @ApiOperation({ summary: 'Delete a tenant business domain' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.archive(request.user, id);
  }
}
