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
import { CreateProspectDto } from './dto/create-prospect.dto';
import {
  ProspectListResponseDto,
  QueryProspectsDto,
} from './dto/query-prospects.dto';
import {
  ProspectDetailResponseDto,
  ProspectResponseDto,
} from './dto/prospect-response.dto';
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
