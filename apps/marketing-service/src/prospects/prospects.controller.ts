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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiOkResponse,
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
import { CreateProspectInteractionDto } from './dto/create-prospect-interaction.dto';
import { CreateProspectDto } from './dto/create-prospect.dto';
import {
  ProspectListResponseDto,
  QueryProspectsDto,
} from './dto/query-prospects.dto';
import {
  ProspectDetailInteractionDto,
  ProspectDetailResponseDto,
  ProspectInteractionHistoryResponseDto,
  ProspectResponseDto,
} from './dto/prospect-response.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { ProspectsService } from './prospects.service';

@Controller('prospects')
@ApiTags('Marketing - Prospects')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or prospect permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ProspectsController {
  constructor(private readonly service: ProspectsService) {}

  @Get()
  @RequireAnyPermission(MarketingCrmSettingsPermission.PROSPECTS_VIEW)
  @ApiOperation({
    summary: 'List marketing prospects',
    description:
      'Users with marketing.prospects:VIEW see their assigned prospects. Users with marketing.prospects.all:VIEW may list tenant-wide prospects and filter by Sales Representative.',
  })
  @ApiOkResponse({ type: ProspectListResponseDto })
  list(
    @Query() query: QueryProspectsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.list(request.user, query);
  }

  @Get(':prospectId/interactions')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_VIEW,
    MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_VIEW_ALL,
  )
  @ApiOperation({
    summary: 'List marketing prospect interaction history',
    description:
      'Users with marketing.prospects.interactions:VIEW can view interaction history for assigned prospects. Users with marketing.prospects.interactions.all:VIEW can view interaction history for any prospect within their tenant.',
  })
  @ApiParam({ name: 'prospectId', format: 'uuid' })
  @ApiOkResponse({ type: ProspectInteractionHistoryResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  listInteractions(
    @Param('prospectId', ParseUUIDPipe) prospectId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.listInteractions(request.user, prospectId);
  }

  @Post(':prospectId/interactions')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE,
    MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
  )
  @ApiOperation({
    summary: 'Record a marketing prospect interaction',
    description:
      'Users with marketing.prospects.interactions:CREATE can record interactions for assigned prospects. Users with marketing.prospects.interactions.all:CREATE can record interactions for any prospect within their tenant.',
  })
  @ApiParam({ name: 'prospectId', format: 'uuid' })
  @ApiCreatedResponse({ type: ProspectDetailInteractionDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createInteraction(
    @Param('prospectId', ParseUUIDPipe) prospectId: string,
    @Body() dto: CreateProspectInteractionDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createInteraction(request.user, prospectId, dto);
  }

  @Get(':id')
  @RequireAnyPermission(MarketingCrmSettingsPermission.PROSPECTS_VIEW)
  @ApiOperation({
    summary: 'Get marketing prospect details',
    description:
      'Users with marketing.prospects:VIEW can view assigned prospects. Users with marketing.prospects.all:VIEW can view any prospect within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectDetailResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.findOne(request.user, id);
  }

  @Patch(':id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.PROSPECTS_EDIT,
    MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL,
  )
  @ApiOperation({
    summary: 'Update a marketing prospect',
    description:
      'Users with marketing.prospects:EDIT can update assigned prospects. Users with marketing.prospects.all:EDIT can update any prospect within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.PROSPECTS_DELETE,
    MarketingCrmSettingsPermission.PROSPECTS_DELETE_ALL,
  )
  @ApiOperation({
    summary: 'Delete a marketing prospect',
    description:
      'Permanently deletes a prospect aggregate. Users with marketing.prospects:DELETE can delete assigned prospects. Users with marketing.prospects.all:DELETE can delete any prospect within their tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Prospect deleted.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.remove(request.user, id);
  }

  @Post()
  @RequireAnyPermission(MarketingCrmSettingsPermission.PROSPECTS_CREATE)
  @ApiOperation({ summary: 'Create a marketing prospect' })
  @ApiCreatedResponse({ type: ProspectResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(
    @Body() dto: CreateProspectDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.create(request.user, dto);
  }
}
