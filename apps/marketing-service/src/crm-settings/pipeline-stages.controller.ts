import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { MarketingCrmSettingsPermission } from './crm-settings.permissions';
import { ApiErrorResponseDto } from './dto/prospecting-setting.dto';
import {
  CreatePipelineStageDto,
  PipelineStageResponseDto,
  PipelineStagesListResponseDto,
  QueryPipelineStagesDto,
  UpdatePipelineStageDto,
} from './dto/pipeline-stage.dto';
import { PipelineStagesService } from './pipeline-stages.service';

const PIPELINE_STAGE_PERMISSIONS = {
  view: MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW,
  create: MarketingCrmSettingsPermission.PIPELINE_STAGES_CREATE,
  edit: MarketingCrmSettingsPermission.PIPELINE_STAGES_EDIT,
  delete: MarketingCrmSettingsPermission.PIPELINE_STAGES_DELETE,
} as const;

@Controller('crm-settings/pipeline-stages')
@ApiTags('Marketing - CRM Settings')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, pipeline feature or pipeline settings permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'pipeline')
export class PipelineStagesController {
  constructor(private readonly service: PipelineStagesService) {}

  @Get()
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    PIPELINE_STAGE_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'List sales pipeline stages' })
  @ApiOkResponse({ type: PipelineStagesListResponseDto })
  list(
    @Query() query: QueryPipelineStagesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user.tenantId, query);
  }

  @Post()
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_CREATE,
    PIPELINE_STAGE_PERMISSIONS.create,
  )
  @ApiOperation({ summary: 'Create a sales pipeline stage' })
  @ApiCreatedResponse({ type: PipelineStageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreatePipelineStageDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
    PIPELINE_STAGE_PERMISSIONS.view,
  )
  @ApiOperation({ summary: 'Get a sales pipeline stage' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PipelineStageResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
    PIPELINE_STAGE_PERMISSIONS.edit,
  )
  @ApiOperation({ summary: 'Update a sales pipeline stage' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PipelineStageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineStageDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.CRM_SETTINGS_DELETE,
    PIPELINE_STAGE_PERMISSIONS.delete,
  )
  @ApiOperation({ summary: 'Archive a sales pipeline stage' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PipelineStageResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.archive(request.user, id);
  }
}
