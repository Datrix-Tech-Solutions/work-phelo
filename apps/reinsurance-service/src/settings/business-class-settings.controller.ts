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
import { BusinessClassSettingsService } from './business-class-settings.service';
import { BusinessClassSettingsPermission } from './business-class-settings.permissions';
import {
  ApiErrorResponseDto,
  BusinessClassFormSchemaResponseDto,
  BusinessClassResponseDto,
  PaginatedBusinessClassesResponseDto,
} from './dto/business-class-response.dto';
import { CreateBusinessClassDto } from './dto/create-business-class.dto';
import { CreateBusinessClassFieldDto } from './dto/create-business-class-field.dto';
import { QueryBusinessClassesDto } from './dto/query-business-classes.dto';
import { UpdateBusinessClassDto } from './dto/update-business-class.dto';
import { UpdateBusinessClassFieldDto } from './dto/update-business-class-field.dto';

@Controller('settings/business-classes')
@ApiTags('Business Class Settings')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Module, feature or required permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class BusinessClassSettingsController {
  constructor(private readonly service: BusinessClassSettingsService) {}

  @Get()
  @RequirePermissions(BusinessClassSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'List business classes',
    description:
      'Returns non-archived business classes for the authenticated tenant.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status.',
  })
  @ApiOkResponse({ type: PaginatedBusinessClassesResponseDto })
  findAll(
    @Query() query: QueryBusinessClassesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(BusinessClassSettingsPermission.CREATE)
  @ApiOperation({ summary: 'Create a business class' })
  @ApiCreatedResponse({ type: BusinessClassResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid payload.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'A business class with this code already exists.',
  })
  create(
    @Body() dto: CreateBusinessClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(BusinessClassSettingsPermission.VIEW)
  @ApiOperation({ summary: 'Get a business class by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiOkResponse({ type: BusinessClassResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class not found or belongs to another tenant.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(BusinessClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Update a business class' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiOkResponse({ type: BusinessClassResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class not found.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessClassDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(BusinessClassSettingsPermission.DELETE)
  @ApiOperation({
    summary: 'Archive a business class',
    description:
      'Soft-archives the business class. Rejected if active placements reference this class code.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiOkResponse({ type: BusinessClassResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Active placements reference this business class.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class not found.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.archive(request.user, id);
  }

  @Post(':id/fields')
  @RequirePermissions(BusinessClassSettingsPermission.EDIT)
  @ApiOperation({
    summary: 'Add a field to a business class',
    description:
      'Adds a field definition to the BUSINESS_DETAILS or OFFER_DETAILS section.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiCreatedResponse({ description: 'Field created.' })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid payload or SELECT field missing options.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Field key already exists in this section.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class not found.',
  })
  createField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBusinessClassFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createField(request.user, id, dto);
  }

  @Patch(':id/fields/:fieldId')
  @RequirePermissions(BusinessClassSettingsPermission.EDIT)
  @ApiOperation({ summary: 'Update a field on a business class' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid', description: 'Field ID.' })
  @ApiOkResponse({ description: 'Field updated.' })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class or field not found.',
  })
  updateField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateBusinessClassFieldDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateField(request.user, id, fieldId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @RequirePermissions(BusinessClassSettingsPermission.DELETE)
  @ApiOperation({ summary: 'Delete a field from a business class' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiParam({ name: 'fieldId', format: 'uuid', description: 'Field ID.' })
  @ApiOkResponse({ description: 'Field deleted.' })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class or field not found.',
  })
  deleteField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteField(request.user, id, fieldId);
  }

  @Get(':id/form-schema')
  @RequirePermissions(BusinessClassSettingsPermission.VIEW)
  @ApiOperation({
    summary: 'Get the form schema for a business class',
    description:
      'Returns active field definitions split into businessDetails and offerDetails sections. Used by the placement form to render dynamic fields.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Business class ID.' })
  @ApiOkResponse({ type: BusinessClassFormSchemaResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Business class not found.',
  })
  getFormSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.getFormSchema(request.user.tenantId, id);
  }
}
