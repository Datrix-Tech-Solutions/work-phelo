import {
  Body,
  Controller,
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
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  EstimateCampaignDto,
  PreviewCampaignRecipientsDto,
  QueryCampaignsDto,
} from './dto/campaign.dto';

const { CAMPAIGNS_VIEW, CAMPAIGNS_CREATE, CAMPAIGNS_SEND, CAMPAIGNS_CANCEL } =
  MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('campaigns')
@ApiTags('Marketing - Campaigns')
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
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @RequireAnyPermission(CAMPAIGNS_VIEW)
  @ApiOperation({ summary: 'List marketing campaigns' })
  list(@Query() query: QueryCampaignsDto, @Req() request: AuthedRequest) {
    return this.service.list(request.user, query);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'Preview how many messages a campaign would queue',
    description:
      'Counts prospects under the business type and the primary contacts reachable on the chosen channels. Nothing is saved.',
  })
  preview(
    @Body() dto: PreviewCampaignRecipientsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.preview(request.user, dto);
  }

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'Estimate campaign recipients and SMS credit requirements',
    description:
      'Calculates recipient counts, SMS encoding/segments, wallet sufficiency, sender identity validity and non-blocking warnings. Nothing is saved or reserved.',
  })
  estimate(@Body() dto: EstimateCampaignDto, @Req() request: AuthedRequest) {
    return this.service.estimate(request.user, dto);
  }

  @Get(':id')
  @RequireAnyPermission(CAMPAIGNS_VIEW)
  @ApiOperation({ summary: 'Get a campaign with its delivery counts' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthedRequest) {
    return this.service.get(request.user, id);
  }

  @Post()
  @RequireAnyPermission(CAMPAIGNS_CREATE)
  @ApiOperation({
    summary: 'Create a campaign',
    description:
      'Targets the primary contact of every prospect under the business type and records one recipient per channel. Instant campaigns stay PENDING_DISPATCH until delivery is configured.',
  })
  create(@Body() dto: CreateCampaignDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(CAMPAIGNS_SEND)
  @ApiOperation({
    summary: 'Send a pending SMS campaign',
    description:
      'Atomically reserves SMS credits, queues recipient batches for Notification, and records provider results asynchronously.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  send(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthedRequest) {
    return this.service.send(request.user, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(CAMPAIGNS_CANCEL)
  @ApiOperation({
    summary: 'Cancel a campaign before dispatch starts',
    description:
      'Only pending or scheduled campaigns that have not started dispatching can be cancelled.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.cancel(request.user, id);
  }
}
