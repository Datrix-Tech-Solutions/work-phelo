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
import { CreatePlacementEndorsementDto } from './dto/create-placement-endorsement.dto';
import { CreatePlacementEndorsementParticipantDto } from './dto/create-placement-endorsement-participant.dto';
import {
  PlacementEndorsementParticipantListResponseDto,
  PlacementEndorsementParticipantResponseDto,
} from './dto/placement-endorsement-participant-response.dto';
import {
  PlacementEndorsementListResponseDto,
  PlacementEndorsementResponseDto,
} from './dto/placement-endorsement-response.dto';
import { UpdatePlacementEndorsementParticipantStatusDto } from './dto/update-placement-endorsement-participant-status.dto';
import { UpdatePlacementEndorsementParticipantDto } from './dto/update-placement-endorsement-participant.dto';
import { UpdatePlacementEndorsementStatusDto } from './dto/update-placement-endorsement-status.dto';
import { UpdatePlacementEndorsementDto } from './dto/update-placement-endorsement.dto';
import { PlacementEndorsementParticipantsService } from './placement-endorsement-participants.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';
import {
  PlacementClosingListResponseDto,
  PlacementClosingResponseDto,
} from './dto/placement-closing-response.dto';
import { UpdatePlacementClosingStatusDto } from './dto/update-placement-closing-status.dto';
import { PlacementClosingsService } from './placement-closings.service';
import {
  PlacementNoteListResponseDto,
  PlacementNoteResponseDto,
} from './dto/placement-note-response.dto';
import { UpdatePlacementNoteStatusDto } from './dto/update-placement-note-status.dto';
import { VoidPlacementNoteDto } from './dto/void-placement-note.dto';
import { PlacementNotesService } from './placement-notes.service';
import {
  PlacementPaymentListResponseDto,
  PlacementPaymentResponseDto,
} from './dto/placement-payment-response.dto';
import { CreatePlacementPaymentDto } from './dto/create-placement-payment.dto';
import { PlacementPaymentsService } from './placement-payments.service';
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
    private readonly endorsementsService: PlacementEndorsementsService,
    private readonly endorsementParticipantsService: PlacementEndorsementParticipantsService,
    private readonly notesService: PlacementNotesService,
    private readonly paymentsService: PlacementPaymentsService,
  ) {}

  @Get()
  @ApiTags('Reinsurance - Placements')
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
  @ApiTags('Reinsurance - Placements')
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
  @ApiTags('Reinsurance - Placements')
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
  @ApiTags('Reinsurance - Financial Locking')
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

  @Get(':id/endorsements')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement endorsements',
    description:
      'Returns versioned placement adjustment records. Endorsements are child records and do not mutate the original placement, participants, closings, payments or notes.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementEndorsementListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  findEndorsements(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService
      .findAll(request.user.tenantId, id)
      .then((items) => ({ items }));
  }

  @Post(':id/endorsements')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.CREATE)
  @ApiOperation({
    summary: 'Create placement endorsement',
    description:
      'Creates a DRAFT versioned adjustment linked to the original placement. The backend captures originalSnapshot at creation. No endorsement participants, closings, notes, payments, claims, documents or frontend changes are created in PR1.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid endorsement payload or the placement has no closing yet.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  createEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementEndorsementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.create(request.user, id, dto);
  }

  @Get(':id/endorsements/:endorsementId')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get placement endorsement by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  findEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.findOne(
      request.user.tenantId,
      id,
      endorsementId,
    );
  }

  @Patch(':id/endorsements/:endorsementId')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Update draft placement endorsement',
    description:
      'Updates editable endorsement metadata and proposedSnapshot. Only DRAFT endorsements can be edited directly. Original placement and financial history remain unchanged.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Endorsement is no longer DRAFT or payload is invalid.',
  })
  updateEndorsement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: UpdatePlacementEndorsementDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.update(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Patch(':id/endorsements/:endorsementId/status')
  @ApiTags('Reinsurance - Endorsements')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change placement endorsement status',
    description:
      'Moves an endorsement through the PR1 lifecycle. CLOSED, DECLINED and VOID are terminal. Status changes do not mutate the original placement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported endorsement status transition.',
  })
  changeEndorsementStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: UpdatePlacementEndorsementStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementsService.changeStatus(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/participants')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List endorsement participants',
    description:
      'Returns endorsement-scoped reinsurer response records and capacity aggregates. These records do not mutate original placement participants.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement endorsement is missing or belongs to another tenant/placement.',
  })
  findEndorsementParticipants(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.findAll(
      request.user.tenantId,
      id,
      endorsementId,
    );
  }

  @Post(':id/endorsements/:endorsementId/participants')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Add endorsement participant',
    description:
      'Adds an existing or new reinsurer to the endorsement market workflow. originalParticipantId is optional and identifies existing reinsurers from the original placement. Original placement participants are never mutated.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiCreatedResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Counterparty is not an active reinsurer, original participant does not match, status values are invalid or accepted capacity exceeds targetPercent.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description:
      'An active endorsement participant already exists for this reinsurer.',
  })
  createEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Body() dto: CreatePlacementEndorsementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.create(
      request.user,
      id,
      endorsementId,
      dto,
    );
  }

  @Get(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({ summary: 'Get endorsement participant by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The endorsement participant is missing or belongs to another tenant/placement/endorsement.',
  })
  findEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.findOne(
      request.user.tenantId,
      id,
      endorsementId,
      participantId,
    );
  }

  @Patch(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Update endorsement participant',
    description:
      'Updates an endorsement-scoped participant while the endorsement and participant are non-terminal. Original placement participant records remain immutable.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Participant or endorsement is terminal, values are invalid or accepted capacity exceeds targetPercent.',
  })
  updateEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementEndorsementParticipantDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.update(
      request.user,
      id,
      endorsementId,
      participantId,
      dto,
    );
  }

  @Patch(':id/endorsements/:endorsementId/participants/:participantId/status')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Change endorsement participant status',
    description:
      'Moves an endorsement participant through INVITED, OFFER_SENT, QUOTED, ACCEPTED, DECLINED and CLOSED. DECLINED and CLOSED are terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({ type: PlacementEndorsementParticipantResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Unsupported status transition, missing accepted signed line or accepted capacity exceeds targetPercent.',
  })
  changeEndorsementParticipantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdatePlacementEndorsementParticipantStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.endorsementParticipantsService.changeStatus(
      request.user,
      id,
      endorsementId,
      participantId,
      dto,
    );
  }

  @Delete(':id/endorsements/:endorsementId/participants/:participantId')
  @ApiTags('Reinsurance - Endorsement Participants')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Delete non-terminal endorsement participant',
    description:
      'Removes an endorsement-scoped participant only while the endorsement and participant are non-terminal. Original placement participants are not changed.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'endorsementId',
    format: 'uuid',
    description: 'Placement endorsement ID.',
  })
  @ApiParam({
    name: 'participantId',
    format: 'uuid',
    description: 'Endorsement participant ID.',
  })
  @ApiOkResponse({
    schema: {
      example: { deleted: true },
    },
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Participant or endorsement is terminal.',
  })
  async deleteEndorsementParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('endorsementId', ParseUUIDPipe) endorsementId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    await this.endorsementParticipantsService.delete(
      request.user,
      id,
      endorsementId,
      participantId,
    );
    return { deleted: true };
  }

  @Get(':id/notes')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement debit and credit notes',
    description:
      'Returns debit/credit note records generated from confirmed closing snapshots. ' +
      'Notes do not financially lock placements; payments remain the only hard lock trigger.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementNoteListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.notesService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/notes/:noteId')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement note',
    description:
      'Returns one debit or credit note. The note must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or note is archived, missing or belongs to another tenant.',
  })
  findNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.findOne(request.user.tenantId, id, noteId);
  }

  @Post(':id/notes/debit')
  @ApiTags('Reinsurance - Debit Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create placement debit note',
    description:
      'Creates a DRAFT placement-level debit note for the cedant from all CONFIRMED closing snapshots. ' +
      'A debit note does not create a payment and does not financially lock the placement. ' +
      'Only one active debit note is allowed per placement; VOID notes are inactive and retain their numbers.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'No confirmed closing exists or required closing currency/amount data is missing.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active debit note already exists for this placement.',
  })
  createDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createDebitNote(request.user, id);
  }

  @Post(':id/closings/:closingId/notes/credit')
  @ApiTags('Reinsurance - Credit Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Create placement closing credit note',
    description:
      'Creates a DRAFT credit note for one CONFIRMED closing and its reinsurer participant. ' +
      'Values are copied from PlacementClosing snapshots; live participant values are not recalculated. ' +
      'Only one active credit note is allowed per closing; VOID notes are inactive and retain their numbers.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'closingId',
    format: 'uuid',
    description: 'Confirmed placement closing ID.',
  })
  @ApiCreatedResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Closing is not CONFIRMED, is missing snapshot data, or does not belong to a reinsurer.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'An active credit note already exists for this closing.',
  })
  createCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closingId', ParseUUIDPipe) closingId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.createCreditNote(request.user, id, closingId);
  }

  @Patch(':id/notes/:noteId/status')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Issue a draft placement note',
    description:
      'Only DRAFT → ISSUED is supported. VOID uses the dedicated void endpoint. Settlement is deferred.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Unsupported note status transition.',
  })
  issueNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdatePlacementNoteStatusDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.issue(request.user, id, noteId, dto);
  }

  @Post(':id/notes/:noteId/void')
  @ApiTags('Reinsurance - Notes')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Void a draft or issued placement note',
    description:
      'Moves DRAFT or ISSUED notes to VOID with a required void reason. VOID is terminal. Voiding a note does not unlock a placement.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'noteId',
    format: 'uuid',
    description: 'Placement note ID.',
  })
  @ApiOkResponse({ type: PlacementNoteResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Void reason is missing or note is already terminal.',
  })
  voidNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: VoidPlacementNoteDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.notesService.void(request.user, id, noteId, dto);
  }

  @Get(':id/payments')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List placement payments',
    description:
      'Returns immutable payment and reversal records for a placement. ' +
      'Read-only payment history remains available after the placement is financially locked.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiOkResponse({ type: PlacementPaymentListResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement is archived, missing or belongs to another tenant.',
  })
  async findPayments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    const items = await this.paymentsService.findAll(request.user.tenantId, id);
    return { items };
  }

  @Get(':id/payments/:paymentId')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement payment',
    description:
      'Returns one payment or reversal record. The payment must belong to the placement and authenticated tenant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description: 'Placement payment ID.',
  })
  @ApiOkResponse({ type: PlacementPaymentResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  findPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.findOne(request.user.tenantId, id, paymentId);
  }

  @Post(':id/payments')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.CREATE)
  @ApiOperation({
    summary: 'Record a placement payment',
    description:
      'Records the first payment foundation financial fact for a placement. ' +
      'The first recorded payment financially locks the placement and future direct placement/participant edits return 409 until endorsements are implemented. ' +
      'Payment creation remains allowed after lock so additional receipts/disbursements can be recorded. ' +
      'Premium received is placement-level and must come from the cedant. Reinsurer disbursement requires a matching CONFIRMED closing and participant.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiCreatedResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description:
      'Invalid payment type/direction, missing confirmed closing, currency mismatch or invalid counterparty relationship.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement, counterparty, closing or participant is missing or belongs to another tenant.',
  })
  createPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlacementPaymentDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.create(request.user, id, dto);
  }

  @Post(':id/payments/:paymentId/reverse')
  @ApiTags('Reinsurance - Payments')
  @RequirePermissions(PlacementPermission.EDIT)
  @ApiOperation({
    summary: 'Reverse a placement payment',
    description:
      'Creates an auditable reversal payment record and marks the original payment as REVERSED. ' +
      'Reversal never unlocks the placement; once financial activity exists, business changes require the future endorsement workflow.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Placement ID.' })
  @ApiParam({
    name: 'paymentId',
    format: 'uuid',
    description: 'Placement payment ID.',
  })
  @ApiCreatedResponse({ type: PlacementPaymentResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'The payment is already a reversal or cannot be reversed.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'The payment has already been reversed.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description:
      'The placement or payment is archived, missing or belongs to another tenant.',
  })
  reversePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsService.reverse(request.user, id, paymentId);
  }

  @Get(':id/slips/offer-preview')
  @ApiTags('Reinsurance - Slip Previews')
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
  @ApiTags('Reinsurance - Slip Previews')
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
  @ApiTags('Reinsurance - Placement Closings')
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
  @ApiTags('Reinsurance - Placement Closings')
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
  @ApiTags('Reinsurance - Placement Closings')
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
  @ApiTags('Reinsurance - Placement Closings')
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
  @ApiTags('Reinsurance - Placements')
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
  @ApiTags('Reinsurance - Placements')
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
  @ApiTags('Reinsurance - Placement Participants')
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
  @ApiTags('Reinsurance - Placement Participants')
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
  @ApiTags('Reinsurance - Placement Participants')
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
  @ApiTags('Reinsurance - Placement Participants')
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
  @ApiTags('Reinsurance - Placements')
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
