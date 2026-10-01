import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
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
import { MarketingCrmSettingCategory } from '../../prisma/generated/client';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission as Permission } from './crm-settings.permissions';
import {
  ApiErrorResponseDto,
  ProspectingSettingUsageResponseDto,
} from './dto/prospecting-setting.dto';
import { PipelineStagesService } from './pipeline-stages.service';
import { ProspectingSettingsService } from './prospecting-settings.service';

const PIPELINE_STAGES_SLUG = 'pipeline-stages';

const SETTING_CATEGORIES: Record<string, MarketingCrmSettingCategory> = {
  'business-types': MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
  products: MarketingCrmSettingCategory.PRODUCT,
  'source-types': MarketingCrmSettingCategory.SOURCE_TYPE,
  'interaction-media': MarketingCrmSettingCategory.INTERACTION_MEDIUM,
  'decision-makers': MarketingCrmSettingCategory.DECISION_MAKER,
};

/**
 * One read-only "is this CRM setting referenced by prospects?" check for every
 * CRM setting, using the same reference lookup the archive (delete) path uses.
 */
@Controller('crm-settings/usage')
@ApiTags('Marketing - CRM Settings')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or CRM settings permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class CrmSettingsUsageController {
  constructor(
    private readonly settings: ProspectingSettingsService,
    private readonly pipelineStages: PipelineStagesService,
  ) {}

  @Get(':setting/:id')
  @RequireAnyPermission(
    Permission.CRM_SETTINGS_VIEW,
    Permission.PIPELINE_STAGES_VIEW,
    Permission.PRODUCTS_VIEW,
    Permission.DECISION_MAKERS_VIEW,
    Permission.SOURCE_TYPES_VIEW,
    Permission.INTERACTION_MEDIA_VIEW,
    Permission.BUSINESS_TYPES_VIEW,
  )
  @ApiOperation({
    summary: 'Check whether a CRM setting is in use by prospects',
  })
  @ApiParam({
    name: 'setting',
    enum: [PIPELINE_STAGES_SLUG, ...Object.keys(SETTING_CATEGORIES)],
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectingSettingUsageResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getUsage(
    @Param('setting') setting: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const { tenantId } = request.user;

    if (setting === PIPELINE_STAGES_SLUG) {
      return this.pipelineStages.getUsage(tenantId, id);
    }

    const category = SETTING_CATEGORIES[setting];
    if (!category) throw new NotFoundException('CRM setting not found');
    return this.settings.getUsage(tenantId, category, id);
  }
}
