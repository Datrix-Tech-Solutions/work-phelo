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
import { PlacementStatus } from '../../prisma/generated/client';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiErrorResponseDto,
  PaginatedPlacementsResponseDto,
  PlacementResponseDto,
} from './dto/placement-response.dto';
import { CreatePlacementParticipantDto } from './dto/create-placement-participant.dto';
import { CreatePlacementDto } from './dto/create-placement.dto';
import { QueryPlacementsDto } from './dto/query-placements.dto';
import { UpdatePlacementParticipantStatusDto } from './dto/update-placement-participant-status.dto';
import { UpdatePlacementParticipantDto } from './dto/update-placement-participant.dto';
import { UpdatePlacementStatusDto } from './dto/update-placement-status.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';
import { PlacementPermission } from './placement.permissions';
import { PlacementsService } from './placements.service';

@Controller('placements')
@ApiTags('Placements')
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
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Get()
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List active facultative placements',
    description:
      'Returns only non-archived placements in the authenticated tenant.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'FAC-2026' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PlacementStatus,
  })
  @ApiQuery({
    name: 'placementType',
    required: false,
    enum: ['FACULTATIVE'],
  })
  @ApiQuery({
    name: 'cedantId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ type: PaginatedPlacementsResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid query filter or pagination value.',
  })
  findAll(
    @Query() query: QueryPlacementsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(PlacementPermission.CREATE)
  @ApiOperation({
    summary: 'Create a facultative placement',
    description:
      'Creates a DRAFT placement linked to an active tenant-owned cedant counterparty. Fixed placement fields remain column-backed, while class-specific fields should be supplied under businessDetails and offerDetails based on classOfBusiness.',
  })
  @ApiCreatedResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid payload, missing cedant or invalid participant role.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active placement with this reference already exists.',
  })
  create(
    @Body() dto: CreatePlacementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get an active placement by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Update an active placement',
    description:
      'If participants are supplied, the supplied array replaces the complete stored participant collection. Status changes must use the status endpoint. businessDetails and offerDetails are stored as JSON objects keyed by classOfBusiness.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid or empty update payload.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active placement with this reference already exists.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.update(request.user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({ summary: 'Change placement lifecycle status' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid status transition.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.changeStatus(request.user, id, dto);
  }

  @Post(':id/participants')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Add a participant to a placement',
    description:
      'Adds a tenant-owned reinsurer or broker participant without replacing the existing participant collection. Participant status defaults to INVITED.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid participant, duplicate counterparty/role or invalid capacity.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.addParticipant(request.user, id, dto);
  }

  @Patch(':id/participants/:participantId')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Update one placement participant',
    description:
      'Updates a single participant without replacing the whole collection. Use the status endpoint for workflow state changes when possible.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid participant patch, duplicate counterparty/role or invalid capacity.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  updateParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.updateParticipant(
      request.user,
      id,
      participantId,
      dto,
    );
  }

  @Patch(':id/participants/:participantId/status')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change one placement participant workflow status',
    description:
      'Moves a participant through INVITED, OFFER_SENT, QUOTED, ACCEPTED, DECLINED and CLOSED. ACCEPTED participants must already have a signedLinePercent.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid participant status transition.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  changeParticipantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementParticipantStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.changeParticipantStatus(
      request.user,
      id,
      participantId,
      dto,
    );
  }

  @Delete(':id/participants/:participantId')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Remove one placement participant',
    description:
      'Deletes a participant from an editable placement without archiving the placement itself.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  deleteParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.deleteParticipant(
      request.user,
      id,
      participantId,
    );
  }

  @Delete(':id')
  @RequirePermissions(PlacementPermission.DELETE)
  @ApiOperation({
    summary: 'Archive a placement',
    description:
      'Soft-archives the active record. Archived records are excluded from standard list and detail requests.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.archive(request.user, id);
  }
}
