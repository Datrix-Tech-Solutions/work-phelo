/**
 * Backward-compatible alias controller.
 *
 * Route: /settings/business-classes
 *
 * Current public compatibility route for risk-class settings. Internally this
 * delegates to RiskClass/RiskType services. Dedicated /settings/risk-classes
 * and /settings/risk-types routes are deferred to the next PR.
 *
 * Delegation:
 *   - Main entity CRUD  → RiskClassSettingsService
 *   - Field operations  → RiskTypeSettingsService (route :id is treated as riskTypeId)
 */
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RiskClassSettingsPermission } from './risk-class-settings.permissions';
import { RiskClassSettingsService } from './risk-class-settings.service';
import { RiskTypeSettingsService } from './risk-type-settings.service';
import {
  ApiErrorResponseDto,
  PaginatedRiskClassesResponseDto,
  RiskClassResponseDto,
  RiskTypeFormSchemaResponseDto,
  RiskTypeResponseDto,
} from './dto/risk-class-response.dto';
import { CreateRiskClassDto } from './dto/create-risk-class.dto';
import { UpdateRiskClassDto } from './dto/update-risk-class.dto';
import { QueryRiskClassesDto } from './dto/query-risk-classes.dto';
import { CreateRiskTypeFieldDto } from './dto/create-risk-type-field.dto';
import { UpdateRiskTypeFieldDto } from './dto/update-risk-type-field.dto';

@Controller('settings/business-classes')
@ApiTags('Business Class Settings (Compatibility route for RiskClass/RiskType)')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class BusinessClassSettingsController {
  constructor(
    private readonly riskClassService: RiskClassSettingsService,
    private readonly riskTypeService: RiskTypeSettingsService,
  ) {}

  // ── Risk Class CRUD ──────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: '[Alias] List risk classes' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiOkResponse({ type: PaginatedRiskClassesResponseDto })
  findAll(
    @Query() query: QueryRiskClassesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(RiskClassSettingsPermission.CREATE)
  @ApiOperation({ summary: '[Alias] Create a risk class' })
  @ApiCreatedResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateRiskClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: '[Alias] Get a risk class by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: '[Alias] Update a risk class' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(RiskClassSettingsPermission.DELETE)
  @ApiOperation({ summary: '[Alias] Archive a risk class' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RiskClassResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskClassService.archive(request.user, id);
  }

  // ── RiskTypeField operations (treats :id as riskTypeId) ─────────────────

  @Post(':id/fields')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({
    summary: '[Alias] Add a field to a risk type (id = riskTypeId)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiCreatedResponse({ description: 'Field created.' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRiskTypeFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.createField(request.user, id, dto);
  }

  @Patch(':id/fields/:fieldId')
  @RequirePermissions(RiskClassSettingsPermission.EDIT)
  @ApiOperation({ summary: '[Alias] Update a field on a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid' })
  @ApiOkResponse({ description: 'Field updated.' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateRiskTypeFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.updateField(request.user, id, fieldId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @RequirePermissions(RiskClassSettingsPermission.DELETE)
  @ApiOperation({ summary: '[Alias] Delete a field from a risk type' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid' })
  @ApiOkResponse({ description: 'Field deleted.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.deleteField(request.user, id, fieldId);
  }

  @Get(':id/form-schema')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({
    summary: '[Alias] Get form schema for a risk type (id = riskTypeId)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk type ID.' })
  @ApiOkResponse({ type: RiskTypeFormSchemaResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getFormSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.riskTypeService.getFormSchema(request.user.tenantId, id);
  }

  // ── Risk Type sub-resource ────────────────────────────────────────────────

  @Get(':id/risk-types')
  @RequirePermissions(RiskClassSettingsPermission.VIEW)
  @ApiOperation({ summary: '[Alias] List risk types under a risk class' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Risk class ID.' })
  @ApiOkResponse({ type: [RiskTypeResponseDto] })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async listRiskTypes(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const rc = await this.riskClassService.findOne(request.user.tenantId, id);
    return rc.riskTypes;
  }
}
