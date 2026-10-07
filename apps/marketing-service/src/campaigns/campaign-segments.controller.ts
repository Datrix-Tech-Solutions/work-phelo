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
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import { CampaignSegmentsService } from './campaign-segments.service';
import {
  CreateSegmentDto,
  SegmentRulesDto,
  UpdateSegmentDto,
} from './dto/segment.dto';

const { CAMPAIGNS_VIEW, CAMPAIGNS_CREATE } = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

/** Saved campaign audiences. Declared before the campaigns controller so `segments` isn't read as a campaign id. */
@Controller('campaigns/segments')
@ApiTags('Marketing - Campaign segments')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or campaign permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class CampaignSegmentsController {
  constructor(private readonly service: CampaignSegmentsService) {}

  @Get()
  @RequireAnyPermission(CAMPAIGNS_VIEW, CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'List the segments a campaign can target',
    description:
      'Saved segments shared across the tenant, then one built-in segment per active business type, each with how many prospects it holds.',
  })
  list(@Req() request: AuthedRequest) {
    return this.service.list(request.user);
  }

  @Post('count')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({ summary: 'How many prospects some segment rules match' })
  count(@Body() dto: SegmentRulesDto, @Req() request: AuthedRequest) {
    return this.service.count(request.user, dto);
  }

  @Post()
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({ summary: 'Save a segment for everyone in the tenant to use' })
  create(@Body() dto: CreateSegmentDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'Edit a saved segment',
    description: 'Applies to campaigns created from now on, not existing ones.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSegmentDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'Delete a saved segment',
    description: 'Campaigns already created from it are not affected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    await this.service.remove(request.user, id);
  }
}
