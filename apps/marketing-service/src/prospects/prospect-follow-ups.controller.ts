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
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  CompleteProspectFollowUpDto,
  CompleteProspectFollowUpResponseDto,
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
  // Open to the record's assignee: the service scopes it to the caller's own records unless they
  // hold the matching tenant-wide permission.
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
  // Open to the record's assignee: the service scopes it to the caller's own records unless they
  // hold the matching tenant-wide permission.
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
  // Open to the record's assignee: the service scopes it to the caller's own records unless they
  // hold the matching tenant-wide permission.
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

  @Post(':id/complete')
  // Open to the record's assignee: the service scopes it to the caller's own records unless they
  // hold the matching tenant-wide permission.
  @ApiOperation({
    summary: 'Complete a pending marketing prospect follow-up',
    description:
      'Records the related prospect interaction, marks the pending explicit follow-up as completed, and optionally schedules the next explicit follow-up in one transaction.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CompleteProspectFollowUpResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteProspectFollowUpDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.completeFollowUp(request.user, id, dto);
  }
}
