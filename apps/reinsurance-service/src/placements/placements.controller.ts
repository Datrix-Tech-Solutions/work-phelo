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
import {
  PlacementClosingListResponseDto,
  PlacementClosingResponseDto,
} from './dto/placement-closing-response.dto';
import { UpdatePlacementClosingStatusDto } from './dto/update-placement-closing-status.dto';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementLockStatusDto } from './dto/placement-lock-status.dto';
import {
  ClosingSlipPreviewResponseDto,
  OfferSlipPreviewResponseDto,
} from './dto/slip-preview-response.dto';
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
  constructor(
    private readonly placementsService: PlacementsService,
    private readonly closingsService: PlacementClosingsService,
  ) {}

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

  @Get(':id/lock-status')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get placement financial lock status',
    description:
      'Returns the current direct-edit policy decision for this placement. ' +
      'Lifecycle locks (for example CLOSED/CANCELLED) are distinct from financial locks. ' +
      'Only actual payment or settlement activity will hard-lock a placement; debit note issuance alone is not a hard lock in the MVP policy. ' +
      'When locked=true, future business changes require the future endorsement workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementLockStatusDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getLockStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getLockStatus(request.user.tenantId, id);
  }

  @Get(':id/slips/offer-preview')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Preview placement offer slip values',
    description:
      'Returns read-only slip preview data for the placement. ' +
      'The calculation fields mirror the current frontend preview formulas exactly. ' +
      'No PDF, document record or email is created. ' +
      'Participant-specific preview rows use each participant brokerageFee, matching the current UI.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: OfferSlipPreviewResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  getOfferSlipPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getOfferSlipPreview(
      request.user.tenantId,
      id,
    );
  }

  @Get(':id/participants/:participantId/slips/closing-preview')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Preview participant closing slip values',
    description:
      'Returns read-only closing preview data for an accepted/closed participant. ' +
      'The calculation fields mirror the current frontend preview formulas exactly. ' +
      'No PDF, document record or email is created. ' +
      'Requires signedLinePercent greater than 0 and participant status ACCEPTED or CLOSED.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiOkResponse({ type: ClosingSlipPreviewResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Participant is not ACCEPTED/CLOSED or has no signed line percentage.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  getClosingSlipPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.getClosingSlipPreview(
      request.user.tenantId,
      id,
      participantId,
    );
  }

  @Get(':id/closings')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement closings',
    description:
      'Returns closing records for the placement in the authenticated tenant. ' +
      'Closings are persisted financial snapshots; no PDF, document registry entry, payment, debit note, credit note or email is created by this endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementClosingListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findClosings(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.closingsService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/closings/:closingId')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement closing',
    description:
      'Returns one closing snapshot by ID. The closing must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Placement closing ID.',
  })
  @ApiOkResponse({ type: PlacementClosingResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or closing is archived, missing or belongs to another tenant.',
  })
  findClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.findOne(request.user.tenantId, id, closingId);
  }

  @Post(':id/participants/:participantId/closings')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create a participant closing snapshot',
    description:
      'Creates a DRAFT closing for an ACCEPTED participant with signedLinePercent greater than 0. ' +
      'placement.premium is required because closing financial values are snapshotted at creation. ' +
      'Only one active closing is allowed per participant per placement; VOID closings are inactive. ' +
      'No payment, endorsement, claim, debit note, credit note, PDF, document record or email is created.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Placement participant ID.',
  })
  @ApiCreatedResponse({ type: PlacementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Placement premium is missing, participant is not ACCEPTED, or signedLinePercent is not greater than 0.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active non-VOID closing already exists for this participant.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or participant is archived, missing or belongs to another tenant.',
  })
  createClosing(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.create(request.user, id, participantId);
  }

  @Patch(':id/closings/:closingId/status')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change placement closing status',
    description:
      'Moves a closing through the MVP lifecycle: DRAFT → ISSUED → CONFIRMED, with VOID available from DRAFT or ISSUED. ' +
      'CONFIRMED and VOID are terminal states.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Placement closing ID.',
  })
  @ApiOkResponse({ type: PlacementClosingResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid closing status transition.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or closing is archived, missing or belongs to another tenant.',
  })
  changeClosingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Body() dto: UpdatePlacementClosingStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.closingsService.changeStatus(request.user, id, closingId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Update an active placement',
    description:
      'Updates placement header fields. ' +
      'CLOSED and CANCELLED placements cannot be edited — a 400 is returned. ' +
      'Financially locked placements cannot be edited directly — a 409 is returned and a future endorsement workflow is required. ' +
      'If participants are supplied, the supplied array replaces the complete stored participant collection; ' +
      'omit participants when editing only header fields and prefer the participant-specific endpoints instead. ' +
      'Status changes must use the dedicated status endpoint. ' +
      'businessDetails and offerDetails are JSON objects validated against RiskTypeField definitions ' +
      'when riskTypeId is set.',
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
    description:
      'An active placement with this reference already exists, or the placement is financially locked.',
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
  @ApiOperation({
    summary: 'Change placement lifecycle status',
    description:
      'Advances or reverses the placement through its lifecycle. ' +
      'Only transitions listed in the allowed matrix are accepted; an invalid move returns 400.\n\n' +
      'Allowed transitions: DRAFT→MARKETING|CANCELLED, ' +
      'MARKETING→PARTIALLY_PLACED|PLACED|DECLINED|CANCELLED, ' +
      'PARTIALLY_PLACED→MARKETING|PLACED|DECLINED|CANCELLED, ' +
      'PLACED→PARTIALLY_PLACED|CLOSING|CANCELLED, ' +
      'CLOSING→PLACED|CLOSED|CANCELLED, ' +
      'CLOSED→CLOSING when no financial lock exists, ' +
      'DECLINED→MARKETING. ' +
      'CANCELLED is terminal.\n\n' +
      'CLOSED remains directly non-editable. Reopen unpaid CLOSED placements to CLOSING first, then apply edits through normal placement/participant endpoints. ' +
      'Financially locked placements return 409 and require endorsement.\n\n' +
      'MARKETING, PARTIALLY_PLACED and PLACED are also set automatically by participant ' +
      'capacity recalculation — use this endpoint only when a manual override is needed ' +
      '(e.g. advancing to DECLINED before participant statuses are updated, or ' +
      'manually entering CLOSING once the placement is ready to bind). ' +
      'Every status change is recorded in statusHistory.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid status transition or terminal placement.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and requires endorsement for business-state changes.',
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
      'Adds a tenant-owned reinsurer or broker participant without replacing the existing participant collection. ' +
      'Participant status defaults to INVITED when omitted. ' +
      'CLOSED and CANCELLED placements block this action. ' +
      'Financially locked placements return 409 and require endorsement. ' +
      'After adding, placement status is automatically recalculated for MARKETING, PARTIALLY_PLACED and PLACED placements.',
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
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement.',
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
      'Updates a single participant without replacing the whole collection. ' +
      'Financially locked placements return 409 and require endorsement. ' +
      'Use the status endpoint for workflow state changes when possible.',
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
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement.',
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
      'Moves a participant through its workflow: INVITED → OFFER_SENT → QUOTED → ACCEPTED → CLOSED, ' +
      'with DECLINED available from most states and re-entry via OFFER_SENT. ' +
      'Moving to ACCEPTED requires signedLinePercent to already be set and greater than 0 on the participant — ' +
      'update it via PATCH /participants/:id first if needed. ' +
      'After the status change, placement status is automatically recalculated when the placement is ' +
      'MARKETING, PARTIALLY_PLACED or PLACED: ' +
      'no accepted capacity → MARKETING, ' +
      'partial capacity → PARTIALLY_PLACED, ' +
      'full capacity → PLACED. ' +
      'The response always reflects the final recalculated placement state.',
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
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant workflow changes require endorsement.',
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
      'Deletes a participant from an editable placement without archiving the placement itself. ' +
      'Financially locked placements return 409 and require endorsement.',
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
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is financially locked and participant changes require endorsement.',
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
      'Soft-archives the active record. Archived records are excluded from standard list and detail requests. ' +
      'Financially locked placements return 409 and cannot be archived directly.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The placement is financially locked and cannot be archived.',
  })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.placementsService.archive(request.user, id);
  }
}
