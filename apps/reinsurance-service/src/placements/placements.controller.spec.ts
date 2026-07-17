import { RequestUser } from '@work-phelo/types';
import { StreamableFile } from '@nestjs/common';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  PlacementClosingStatus,
  PlacementNoteStatus,
  PlacementPaymentDirection,
  PlacementPaymentType,
  PlacementEndorsementParticipantStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
} from '../../prisma/generated/client';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PlacementPermission } from './placement.permissions';
import { PlacementClaimCashCallsService } from './placement-claim-cash-calls.service';
import { PlacementClaimsService } from './placement-claims.service';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementDocumentsService } from './placement-documents.service';
import { PlacementEndorsementClosingsService } from './placement-endorsement-closings.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';
import { PlacementEndorsementParticipantsService } from './placement-endorsement-participants.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { PlacementNotesService } from './placement-notes.service';
import { PlacementPaymentsService } from './placement-payments.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

describe('PlacementsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    getLockStatus: jest.fn(),
    getOfferSlipPreview: jest.fn(),
    getClosingSlipPreview: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    forceClose: jest.fn(),
    addParticipant: jest.fn(),
    updateParticipant: jest.fn(),
    changeParticipantStatus: jest.fn(),
    acceptParticipantAndConfirm: jest.fn(),
    deleteParticipant: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  };
  const closingsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
  };
  const documentsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    generateOfferSlip: jest.fn(),
    generateParticipantOfferSlip: jest.fn(),
    generateClosingSlip: jest.fn(),
    generateNoteDocument: jest.fn(),
    generateEndorsementSlip: jest.fn(),
    generateEndorsementClosingSlip: jest.fn(),
    generateClaimNotice: jest.fn(),
    generateClaimCashCall: jest.fn(),
    renderPdf: jest.fn(),
    renderAndStorePdf: jest.fn(),
    createDownloadUrl: jest.fn(),
    void: jest.fn(),
  };
  const endorsementsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getSummary: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
  };
  const effectiveViewService = {
    getEffectiveView: jest.fn(),
  };
  const endorsementParticipantsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    delete: jest.fn(),
  };
  const endorsementClosingsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
  };
  const notesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findAllEndorsementNotes: jest.fn(),
    findEndorsementNote: jest.fn(),
    createDebitNote: jest.fn(),
    createCreditNote: jest.fn(),
    createEndorsementDebitNote: jest.fn(),
    createEndorsementCreditNote: jest.fn(),
    issue: jest.fn(),
    issueEndorsementNote: jest.fn(),
    void: jest.fn(),
    voidEndorsementNote: jest.fn(),
  };
  const paymentsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    reverse: jest.fn(),
  };
  const claimsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    findAllocations: jest.fn(),
    generateAllocations: jest.fn(),
  };
  const claimCashCallsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
    void: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementsController(
      service as unknown as PlacementsService,
      closingsService as unknown as PlacementClosingsService,
      documentsService as unknown as PlacementDocumentsService,
      endorsementsService as unknown as PlacementEndorsementsService,
      effectiveViewService as unknown as PlacementEffectiveViewService,
      endorsementParticipantsService as unknown as PlacementEndorsementParticipantsService,
      endorsementClosingsService as unknown as PlacementEndorsementClosingsService,
      notesService as unknown as PlacementNotesService,
      paymentsService as unknown as PlacementPaymentsService,
      claimsService as unknown as PlacementClaimsService,
      claimCashCallsService as unknown as PlacementClaimCashCallsService,
    );

  it('delegates list queries using only the authenticated tenant context', async () => {
    const controller = createController();
    const query = { page: 1, limit: 20 };

    await controller.findAll(query, { user } as never);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it.each([
    ['findAll', PlacementPermission.VIEW],
    ['findOne', PlacementPermission.VIEW],
    ['getEffectiveView', PlacementPermission.VIEW],
    ['getLockStatus', PlacementPermission.VIEW],
    ['getOfferSlipPreview', PlacementPermission.VIEW],
    ['getClosingSlipPreview', PlacementPermission.VIEW],
    ['findClosings', PlacementPermission.VIEW],
    ['findClosing', PlacementPermission.VIEW],
    ['findDocuments', PlacementPermission.VIEW],
    ['findDocument', PlacementPermission.VIEW],
    ['renderDocumentPdf', PlacementPermission.VIEW],
    ['getDocumentDownloadUrl', PlacementPermission.VIEW],
    ['findEndorsements', PlacementPermission.VIEW],
    ['findEndorsement', PlacementPermission.VIEW],
    ['getEndorsementSummary', PlacementPermission.VIEW],
    ['findEndorsementParticipants', PlacementPermission.VIEW],
    ['findEndorsementParticipant', PlacementPermission.VIEW],
    ['findEndorsementClosings', PlacementPermission.VIEW],
    ['findEndorsementClosing', PlacementPermission.VIEW],
    ['findEndorsementNotes', PlacementPermission.VIEW],
    ['findEndorsementNote', PlacementPermission.VIEW],
    ['findNotes', PlacementPermission.VIEW],
    ['findNote', PlacementPermission.VIEW],
    ['findPayments', PlacementPermission.VIEW],
    ['findPayment', PlacementPermission.VIEW],
    ['findClaims', PlacementPermission.VIEW],
    ['findClaim', PlacementPermission.VIEW],
    ['findClaimAllocations', PlacementPermission.VIEW],
    ['findClaimCashCalls', PlacementPermission.VIEW],
    ['findClaimCashCall', PlacementPermission.VIEW],
    ['create', PlacementPermission.CREATE],
    ['createEndorsement', PlacementPermission.CREATE],
    ['createPayment', PlacementPermission.CREATE],
    ['createClaim', PlacementPermission.CREATE],
    ['update', PlacementPermission.EDIT],
    ['updateEndorsement', PlacementPermission.EDIT],
    ['changeEndorsementStatus', PlacementPermission.EDIT],
    ['createEndorsementParticipant', PlacementPermission.EDIT],
    ['updateEndorsementParticipant', PlacementPermission.EDIT],
    ['changeEndorsementParticipantStatus', PlacementPermission.EDIT],
    ['deleteEndorsementParticipant', PlacementPermission.EDIT],
    ['createEndorsementClosing', PlacementPermission.EDIT],
    ['changeEndorsementClosingStatus', PlacementPermission.EDIT],
    ['changeStatus', PlacementPermission.EDIT],
    ['forceClose', PlacementPermission.EDIT],
    ['addParticipant', PlacementPermission.EDIT],
    ['updateParticipant', PlacementPermission.EDIT],
    ['changeParticipantStatus', PlacementPermission.EDIT],
    ['acceptParticipantAndConfirm', PlacementPermission.EDIT],
    ['deleteParticipant', PlacementPermission.EDIT],
    ['createClosing', PlacementPermission.EDIT],
    ['changeClosingStatus', PlacementPermission.EDIT],
    ['generateOfferSlipDocument', PlacementPermission.EDIT],
    ['generateParticipantOfferSlipDocument', PlacementPermission.EDIT],
    ['generateClosingSlipDocument', PlacementPermission.EDIT],
    ['generateNoteDocument', PlacementPermission.EDIT],
    ['generateEndorsementSlipDocument', PlacementPermission.EDIT],
    ['generateEndorsementClosingSlipDocument', PlacementPermission.EDIT],
    ['generateClaimNoticeDocument', PlacementPermission.EDIT],
    ['generateClaimCashCallDocument', PlacementPermission.EDIT],
    ['renderAndStoreDocumentPdf', PlacementPermission.EDIT],
    ['voidDocument', PlacementPermission.EDIT],
    ['createDebitNote', PlacementPermission.EDIT],
    ['createCreditNote', PlacementPermission.EDIT],
    ['createEndorsementDebitNote', PlacementPermission.EDIT],
    ['createEndorsementCreditNote', PlacementPermission.EDIT],
    ['issueEndorsementNote', PlacementPermission.EDIT],
    ['voidEndorsementNote', PlacementPermission.EDIT],
    ['updateClaim', PlacementPermission.EDIT],
    ['changeClaimStatus', PlacementPermission.EDIT],
    ['generateClaimAllocations', PlacementPermission.EDIT],
    ['createClaimCashCall', PlacementPermission.EDIT],
    ['changeClaimCashCallStatus', PlacementPermission.EDIT],
    ['voidClaimCashCall', PlacementPermission.EDIT],
    ['issueNote', PlacementPermission.EDIT],
    ['voidNote', PlacementPermission.EDIT],
    ['reversePayment', PlacementPermission.EDIT],
    ['archive', PlacementPermission.DELETE],
    ['restore', PlacementPermission.DELETE],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementsController.prototype[method as keyof PlacementsController],
      ),
    ).toEqual([permission]);
  });

  it('delegates participant mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.addParticipant(
      'placement-1',
      {
        counterpartyId: 'reinsurer-1',
        role: PlacementParticipantRole.REINSURER,
      },
      { user } as never,
    );
    await controller.updateParticipant(
      'placement-1',
      'participant-1',
      { sharePercent: 25 },
      { user } as never,
    );
    await controller.changeParticipantStatus(
      'placement-1',
      'participant-1',
      { status: PlacementParticipantStatus.OFFER_SENT },
      { user } as never,
    );
    await controller.acceptParticipantAndConfirm(
      'placement-1',
      'participant-1',
      { user } as never,
    );
    await controller.deleteParticipant('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.addParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      expect.objectContaining({ counterpartyId: 'reinsurer-1' }),
    );
    expect(service.updateParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ sharePercent: 25 }),
    );
    expect(service.changeParticipantStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ status: 'OFFER_SENT' }),
    );
    expect(service.acceptParticipantAndConfirm).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(service.deleteParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
  });

  it('delegates slip preview reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getOfferSlipPreview('placement-1', { user } as never);
    await controller.getClosingSlipPreview('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.getOfferSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(service.getClosingSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'participant-1',
    );
  });

  it('delegates lock status reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getLockStatus('placement-1', { user } as never);

    expect(service.getLockStatus).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
  });

  it('delegates force close with authenticated user context', async () => {
    const controller = createController();

    await controller.forceClose('placement-1', { user } as never);

    expect(service.forceClose).toHaveBeenCalledWith(user, 'placement-1');
  });

  it('delegates effective view reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getEffectiveView('placement-1', { user } as never);

    expect(effectiveViewService.getEffectiveView).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
  });

  it('delegates closing reads with authenticated tenant context', async () => {
    const controller = createController();
    closingsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findClosings('placement-1', {
      user,
    } as never);
    await controller.findClosing('placement-1', 'closing-1', {
      user,
    } as never);

    expect(closingsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(closingsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'closing-1',
    );
  });

  it('delegates closing mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createClosing('placement-1', 'participant-1', {
      user,
    } as never);
    await controller.changeClosingStatus(
      'placement-1',
      'closing-1',
      { status: PlacementClosingStatus.ISSUED },
      { user } as never,
    );

    expect(closingsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(closingsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
      expect.objectContaining({ status: PlacementClosingStatus.ISSUED }),
    );
  });

  it('delegates endorsement reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementsService.findAll.mockResolvedValue([]);
    endorsementsService.getSummary.mockResolvedValue({ id: 'summary-1' });

    const listResult = await controller.findEndorsements('placement-1', {
      user,
    } as never);
    await controller.findEndorsement('placement-1', 'endorsement-1', {
      user,
    } as never);
    await controller.getEndorsementSummary('placement-1', 'endorsement-1', {
      user,
    } as never);

    expect(endorsementsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(endorsementsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(endorsementsService.getSummary).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
  });

  it('delegates endorsement mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsement(
      'placement-1',
      {
        type: PlacementEndorsementType.SUM_INSURED_INCREASE,
        effectiveDate: '2026-06-04T00:00:00.000Z',
        reason: 'Increase sum insured',
      },
      { user } as never,
    );
    await controller.updateEndorsement(
      'placement-1',
      'endorsement-1',
      { reason: 'Updated' },
      { user } as never,
    );
    await controller.changeEndorsementStatus(
      'placement-1',
      'endorsement-1',
      { status: PlacementEndorsementStatus.MARKETING },
      { user } as never,
    );

    expect(endorsementsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      expect.objectContaining({
        type: PlacementEndorsementType.SUM_INSURED_INCREASE,
      }),
    );
    expect(endorsementsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ reason: 'Updated' }),
    );
    expect(endorsementsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ status: PlacementEndorsementStatus.MARKETING }),
    );
  });

  it('delegates endorsement participant reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementParticipantsService.findAll.mockResolvedValue({
      items: [],
      aggregates: {
        totalOfferedPercent: 0,
        totalAcceptedPercent: 0,
        remainingPercent: null,
        declinedPercent: 0,
      },
    });

    const listResult = await controller.findEndorsementParticipants(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );

    expect(endorsementParticipantsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({
      items: [],
      aggregates: {
        totalOfferedPercent: 0,
        totalAcceptedPercent: 0,
        remainingPercent: null,
        declinedPercent: 0,
      },
    });
    expect(endorsementParticipantsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
  });

  it('delegates endorsement participant mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      {
        counterpartyId: 'reinsurer-1',
        originalParticipantId: 'participant-1',
        sharePercent: 20,
      },
      { user } as never,
    );
    await controller.updateEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { signedLinePercent: 15 },
      { user } as never,
    );
    await controller.changeEndorsementParticipantStatus(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { status: PlacementEndorsementParticipantStatus.OFFER_SENT },
      { user } as never,
    );
    await controller.deleteEndorsementParticipant(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );

    expect(endorsementParticipantsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      expect.objectContaining({ counterpartyId: 'reinsurer-1' }),
    );
    expect(endorsementParticipantsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      expect.objectContaining({ signedLinePercent: 15 }),
    );
    expect(endorsementParticipantsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      expect.objectContaining({
        status: PlacementEndorsementParticipantStatus.OFFER_SENT,
      }),
    );
    expect(endorsementParticipantsService.delete).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
  });

  it('delegates endorsement closing reads with authenticated tenant context', async () => {
    const controller = createController();
    endorsementClosingsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findEndorsementClosings(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementClosing(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );

    expect(endorsementClosingsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(endorsementClosingsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
  });

  it('delegates endorsement closing mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementClosing(
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
      { user } as never,
    );
    await controller.changeEndorsementClosingStatus(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { status: PlacementClosingStatus.ISSUED },
      { user } as never,
    );

    expect(endorsementClosingsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-participant-1',
    );
    expect(endorsementClosingsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      expect.objectContaining({ status: PlacementClosingStatus.ISSUED }),
    );
  });

  it('delegates archive and restore placement lifecycle actions', async () => {
    const controller = createController();

    await controller.archive(
      'placement-1',
      { archiveReason: 'Duplicate placement' },
      { user } as never,
    );
    await controller.restore('placement-1', { user } as never);

    expect(service.archive).toHaveBeenCalledWith(user, 'placement-1', {
      archiveReason: 'Duplicate placement',
    });
    expect(service.restore).toHaveBeenCalledWith(user, 'placement-1');
  });

  it('delegates document registry reads and generation with authenticated context', async () => {
    const controller = createController();
    documentsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findDocuments('placement-1', {
      user,
    } as never);
    await controller.findDocument('placement-1', 'document-1', {
      user,
    } as never);
    documentsService.renderPdf.mockResolvedValue(Buffer.from('%PDF'));
    const pdf = await controller.renderDocumentPdf(
      'placement-1',
      'document-1',
      { user } as never,
    );
    await controller.renderAndStoreDocumentPdf('placement-1', 'document-1', {
      user,
    } as never);
    documentsService.createDownloadUrl.mockResolvedValue({
      url: 'https://signed.example/document.pdf',
      expiresAt: new Date('2026-06-11T12:05:00.000Z'),
      mimeType: 'application/pdf',
      fileName: 'DOC-CS-001.pdf',
    });
    const downloadUrl = await controller.getDocumentDownloadUrl(
      'placement-1',
      'document-1',
      { user } as never,
    );
    await controller.generateOfferSlipDocument('placement-1', {
      user,
    } as never);
    await controller.generateParticipantOfferSlipDocument(
      'placement-1',
      'participant-1',
      { user } as never,
    );
    await controller.generateClosingSlipDocument('placement-1', 'closing-1', {
      user,
    } as never);
    await controller.generateNoteDocument('placement-1', 'note-1', {
      user,
    } as never);
    await controller.generateEndorsementSlipDocument(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.generateEndorsementClosingSlipDocument(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );
    await controller.generateClaimNoticeDocument('placement-1', 'claim-1', {
      user,
    } as never);
    await controller.generateClaimCashCallDocument(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { user } as never,
    );
    await controller.voidDocument(
      'placement-1',
      'document-1',
      { voidReason: 'Replacement generated' },
      { user } as never,
    );

    expect(documentsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(documentsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(documentsService.renderPdf).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(pdf).toBeInstanceOf(StreamableFile);
    expect(documentsService.renderAndStorePdf).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(documentsService.createDownloadUrl).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'document-1',
    );
    expect(downloadUrl).toMatchObject({
      url: 'https://signed.example/document.pdf',
      mimeType: 'application/pdf',
    });
    expect(documentsService.generateOfferSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
    );
    expect(documentsService.generateParticipantOfferSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(documentsService.generateClosingSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
    );
    expect(documentsService.generateNoteDocument).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
    );
    expect(documentsService.generateEndorsementSlip).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
    );
    expect(
      documentsService.generateEndorsementClosingSlip,
    ).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    expect(documentsService.generateClaimNotice).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
    );
    expect(documentsService.generateClaimCashCall).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    expect(documentsService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'document-1',
      expect.objectContaining({ voidReason: 'Replacement generated' }),
    );
  });

  it('delegates note reads with authenticated tenant context', async () => {
    const controller = createController();
    notesService.findAll.mockResolvedValue([]);

    const listResult = await controller.findNotes('placement-1', {
      user,
    } as never);
    await controller.findNote('placement-1', 'note-1', { user } as never);

    expect(notesService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(notesService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'note-1',
    );
  });

  it('delegates endorsement note reads with authenticated tenant context', async () => {
    const controller = createController();
    notesService.findAllEndorsementNotes.mockResolvedValue([]);

    const listResult = await controller.findEndorsementNotes(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.findEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { user } as never,
    );

    expect(notesService.findAllEndorsementNotes).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(notesService.findEndorsementNote).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'note-1',
    );
  });

  it('delegates note create, issue and void with authenticated user context', async () => {
    const controller = createController();

    await controller.createDebitNote('placement-1', { user } as never);
    await controller.createCreditNote('placement-1', 'closing-1', {
      user,
    } as never);
    await controller.issueNote(
      'placement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
      { user } as never,
    );
    await controller.voidNote(
      'placement-1',
      'note-1',
      { voidReason: 'Issued in error' },
      { user } as never,
    );

    expect(notesService.createDebitNote).toHaveBeenCalledWith(
      user,
      'placement-1',
    );
    expect(notesService.createCreditNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
    );
    expect(notesService.issue).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
      expect.objectContaining({ status: PlacementNoteStatus.ISSUED }),
    );
    expect(notesService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'note-1',
      expect.objectContaining({ voidReason: 'Issued in error' }),
    );
  });

  it('delegates endorsement note create, issue and void with authenticated user context', async () => {
    const controller = createController();

    await controller.createEndorsementDebitNote(
      'placement-1',
      'endorsement-1',
      { user } as never,
    );
    await controller.createEndorsementCreditNote(
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
      { user } as never,
    );
    await controller.issueEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
      { user } as never,
    );
    await controller.voidEndorsementNote(
      'placement-1',
      'endorsement-1',
      'note-1',
      { voidReason: 'Issued in error' },
      { user } as never,
    );

    expect(notesService.createEndorsementDebitNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
    );
    expect(notesService.createEndorsementCreditNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );
    expect(notesService.issueEndorsementNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      expect.objectContaining({ status: PlacementNoteStatus.ISSUED }),
    );
    expect(notesService.voidEndorsementNote).toHaveBeenCalledWith(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      expect.objectContaining({ voidReason: 'Issued in error' }),
    );
  });

  it('delegates claim reads and mutations with authenticated context', async () => {
    const controller = createController();
    claimsService.findAll.mockResolvedValue([]);
    claimsService.findAllocations.mockResolvedValue([]);
    const createDto = {
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: 'Warehouse fire',
      currency: 'USD',
      estimatedLossAmount: 40000,
    };
    const updateDto = { finalLossAmount: 37500 };

    const claimList = await controller.findClaims('placement-1', {
      user,
    } as never);
    await controller.findClaim('placement-1', 'claim-1', { user } as never);
    await controller.createClaim('placement-1', createDto, { user } as never);
    await controller.updateClaim('placement-1', 'claim-1', updateDto, {
      user,
    } as never);
    await controller.changeClaimStatus(
      'placement-1',
      'claim-1',
      { status: PlacementClaimStatus.NOTIFIED },
      { user } as never,
    );
    const allocationList = await controller.findClaimAllocations(
      'placement-1',
      'claim-1',
      { user } as never,
    );
    await controller.generateClaimAllocations('placement-1', 'claim-1', {
      user,
    } as never);

    expect(claimsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(claimList).toEqual({ items: [] });
    expect(claimsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(claimsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      createDto,
    );
    expect(claimsService.update).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      updateDto,
    );
    expect(claimsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      expect.objectContaining({ status: PlacementClaimStatus.NOTIFIED }),
    );
    expect(claimsService.findAllocations).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(allocationList).toEqual({ items: [] });
    expect(claimsService.generateAllocations).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
    );
  });

  it('delegates claim cash call reads and mutations with authenticated context', async () => {
    const controller = createController();
    claimCashCallsService.findAll.mockResolvedValue([]);

    const list = await controller.findClaimCashCalls('placement-1', 'claim-1', {
      user,
    } as never);
    await controller.findClaimCashCall(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { user } as never,
    );
    await controller.createClaimCashCall(
      'placement-1',
      'claim-1',
      'allocation-1',
      { user } as never,
    );
    await controller.changeClaimCashCallStatus(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { status: PlacementClaimCashCallStatus.ISSUED },
      { user } as never,
    );
    await controller.voidClaimCashCall(
      'placement-1',
      'claim-1',
      'cash-call-1',
      { voidReason: 'Replacement required' },
      { user } as never,
    );

    expect(claimCashCallsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
    );
    expect(list).toEqual({ items: [] });
    expect(claimCashCallsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'claim-1',
      'cash-call-1',
    );
    expect(claimCashCallsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'allocation-1',
    );
    expect(claimCashCallsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
      expect.objectContaining({ status: PlacementClaimCashCallStatus.ISSUED }),
    );
    expect(claimCashCallsService.void).toHaveBeenCalledWith(
      user,
      'placement-1',
      'claim-1',
      'cash-call-1',
      expect.objectContaining({ voidReason: 'Replacement required' }),
    );
  });

  it('delegates payment reads with authenticated tenant context', async () => {
    const controller = createController();
    paymentsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findPayments('placement-1', {
      user,
    } as never);
    await controller.findPayment('placement-1', 'payment-1', {
      user,
    } as never);

    expect(paymentsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(paymentsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'payment-1',
    );
  });

  it('delegates payment create and reverse with authenticated user context', async () => {
    const controller = createController();
    const dto = {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    };

    await controller.createPayment('placement-1', dto, { user } as never);
    await controller.reversePayment('placement-1', 'payment-1', {
      user,
    } as never);

    expect(paymentsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      dto,
    );
    expect(paymentsService.reverse).toHaveBeenCalledWith(
      user,
      'placement-1',
      'payment-1',
    );
  });
});
