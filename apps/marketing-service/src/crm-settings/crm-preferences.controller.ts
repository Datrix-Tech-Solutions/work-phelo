import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
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
import { CrmPreferencesService } from './crm-preferences.service';
import { MarketingCrmSettingsPermission } from './crm-settings.permissions';
import {
  CrmPreferencesResponseDto,
  UpdateCrmPreferencesDto,
} from './dto/crm-preferences.dto';
import { ApiErrorResponseDto } from './dto/prospecting-setting.dto';

@ApiTags('Marketing CRM Settings')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('crm-settings/preferences')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class CrmPreferencesController {
  constructor(private readonly service: CrmPreferencesService) {}

  @Get()
  @RequireAnyPermission(MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get the tenant-wide CRM preferences' })
  @ApiOkResponse({ type: CrmPreferencesResponseDto })
  get(@Req() request: Request & { user: RequestUser }) {
    return this.service.get(request.user.tenantId);
  }

  @Put()
  @RequireAnyPermission(MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT)
  @ApiOperation({ summary: 'Update the tenant-wide CRM preferences' })
  @ApiOkResponse({ type: CrmPreferencesResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  update(
    @Body() dto: UpdateCrmPreferencesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, dto);
  }
}
