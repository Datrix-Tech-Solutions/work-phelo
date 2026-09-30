import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  ProspectFollowUpResponseDto,
  ProspectFollowUpWorklistResponseDto,
  UpdateProspectFollowUpDto,
} from './dto/prospect-follow-up.dto';
import { ProspectsService } from './prospects.service';

@Controller('follow-ups')
@ApiTags('Marketing - Prospect Follow-Ups')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module, leads feature or follow-up permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('marketing')
@RequireFeature('marketing', 'leads')
export class ProspectFollowUpsController {
  constructor(private readonly service: ProspectsService) {}

  @Get()
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW,
    MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW_ALL,
  )
  @ApiOperation({
    summary: 'List marketing prospect follow-ups that need attention',
    description:
      'Returns pending explicit follow-ups where available; otherwise returns the default latest-interaction plus seven-day follow-up for visible prospects.',
  })
  @ApiOkResponse({ type: ProspectFollowUpWorklistResponseDto })
  listWorklist(@Req() request: Request & { user: RequestUser }) {
    return this.service.listFollowUpWorklist(request.user);
  }

  @Patch(':id')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.FOLLOW_UPS_EDIT,
    MarketingCrmSettingsPermission.FOLLOW_UPS_EDIT_ALL,
  )
  @ApiOperation({
    summary: 'Update a pending marketing prospect follow-up',
    description:
      'Updates due date and/or note only. Completion is handled by interaction capture, and cancellation has a separate endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectFollowUpResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectFollowUpDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateFollowUp(request.user, id, dto);
  }

  @Post(':id/cancel')
  @RequireAnyPermission(
    MarketingCrmSettingsPermission.FOLLOW_UPS_CANCEL,
    MarketingCrmSettingsPermission.FOLLOW_UPS_CANCEL_ALL,
  )
  @ApiOperation({
    summary: 'Cancel a pending marketing prospect follow-up',
    description:
      'Marks a pending explicit follow-up as cancelled. Cancelled follow-ups remain in prospect history but disappear from outstanding follow-up worklists.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProspectFollowUpResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.cancelFollowUp(request.user, id);
  }
}
