import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementDocumentStatus,
  PlacementDocumentType,
  PlacementNoteType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { VoidPlacementDocumentDto } from './dto/void-placement-document.dto';
import { PlacementsService } from './placements.service';

const documentInclude = {} satisfies Prisma.PlacementDocumentInclude;

type PlacementDocumentRecord = Prisma.PlacementDocumentGetPayload<{
  include: typeof documentInclude;
}>;

type DocumentSourceDescriptor = {
  type: PlacementDocumentType;
  prefix: string;
  title: string;
  currency: string | null;
  sourceSnapshot: unknown;
  renderPayload: unknown;
  sourceLinks?: Pick<
    Prisma.PlacementDocumentUncheckedCreateInput,
    | 'participantId'
    | 'closingId'
    | 'noteId'
    | 'endorsementId'
    | 'endorsementClosingId'
    | 'claimId'
    | 'claimCashCallId'
  >;
};

@Injectable()
export class PlacementDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly placementsService: PlacementsService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementDocumentRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementDocument.findMany({
      where: { tenantId, placementId },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    documentId: string,
  ): Promise<PlacementDocumentRecord> {
    await this.assertPlacement(tenantId, placementId);
    const document = await this.prisma.placementDocument.findFirst({
      where: { id: documentId, tenantId, placementId },
      include: documentInclude,
    });
    if (!document) throw new NotFoundException('Placement document not found');
    return document;
  }

  async generateOfferSlip(
    user: RequestUser,
    placementId: string,
  ): Promise<PlacementDocumentRecord> {
    const preview = await this.placementsService.getOfferSlipPreview(
      user.tenantId,
      placementId,
    );

    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.OFFER_SLIP,
      prefix: 'DOC-OS-',
      title: `Offer Slip ${preview.placement.reference}`,
      currency: preview.placement.currency,
      sourceSnapshot: preview,
      renderPayload: preview,
    });
  }

  async generateClosingSlip(
    user: RequestUser,
    placementId: string,
    closingId: string,
  ): Promise<PlacementDocumentRecord> {
    const closing = await this.prisma.placementClosing.findFirst({
      where: { id: closingId, tenantId: user.tenantId, placementId },
      include: {
        participant: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
      },
    });
    if (!closing) throw new NotFoundException('Placement closing not found');

    const snapshot = this.toJsonSafe(closing);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLOSING_SLIP,
      prefix: 'DOC-CS-',
      title: `Closing Slip ${closing.closingNumber}`,
      currency: closing.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: snapshot,
      },
      sourceLinks: {
        closingId: closing.id,
        participantId: closing.participantId,
      },
    });
  }

  async generateNoteDocument(
    user: RequestUser,
    placementId: string,
    noteId: string,
  ): Promise<PlacementDocumentRecord> {
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId: user.tenantId, placementId },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
            email: true,
            phone: true,
            country: true,
          },
        },
        closing: { select: { id: true, closingNumber: true } },
        participant: { select: { id: true, counterpartyId: true } },
      },
    });
    if (!note) throw new NotFoundException('Placement note not found');

    const type = this.documentTypeForNote(note);
    const snapshot = this.toJsonSafe(note);
    return this.createGeneratedDocument(user, placementId, {
      type,
      prefix: this.prefixForDocumentType(type),
      title: `${this.titleForDocumentType(type)} ${note.noteNumber}`,
      currency: note.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: type,
        note: snapshot,
      },
      sourceLinks: {
        noteId: note.id,
        closingId: note.closingId,
        participantId: note.participantId,
      },
    });
  }

  async generateEndorsementSlip(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementDocumentRecord> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: { id: endorsementId, tenantId: user.tenantId, placementId },
      include: {
        participants: true,
        closings: true,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }

    const snapshot = this.toJsonSafe(endorsement);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.ENDORSEMENT_SLIP,
      prefix: 'DOC-ES-',
      title: `Endorsement Slip ${endorsement.endorsementNumber}`,
      currency: null,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.ENDORSEMENT_SLIP,
        endorsement: snapshot,
      },
      sourceLinks: { endorsementId: endorsement.id },
    });
  }

  async generateEndorsementClosingSlip(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<PlacementDocumentRecord> {
    const closing = await this.prisma.placementEndorsementClosing.findFirst({
      where: {
        id: closingId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
      },
      include: {
        endorsement: { select: { id: true, endorsementNumber: true } },
        endorsementParticipant: {
          include: {
            counterparty: {
              select: {
                id: true,
                type: true,
                name: true,
                registrationNumber: true,
                email: true,
                phone: true,
                country: true,
              },
            },
          },
        },
      },
    });
    if (!closing) {
      throw new NotFoundException('Placement endorsement closing not found');
    }

    const snapshot = this.toJsonSafe(closing);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLOSING_SLIP,
      prefix: 'DOC-CS-',
      title: `Endorsement Closing Slip ${closing.closingNumber}`,
      currency: closing.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        endorsementClosing: snapshot,
      },
      sourceLinks: {
        endorsementId: closing.endorsementId,
        endorsementClosingId: closing.id,
      },
    });
  }

  async generateClaimNotice(
    user: RequestUser,
    placementId: string,
    claimId: string,
  ): Promise<PlacementDocumentRecord> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId: user.tenantId, placementId },
      include: {
        allocations: true,
        cashCalls: true,
      },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');

    const snapshot = this.toJsonSafe(claim);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLAIM_NOTICE,
      prefix: 'DOC-CLM-',
      title: `Claim Notice ${claim.claimNumber}`,
      currency: claim.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLAIM_NOTICE,
        claim: snapshot,
      },
      sourceLinks: { claimId: claim.id },
    });
  }

  async generateClaimCashCall(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<PlacementDocumentRecord> {
    const cashCall = await this.prisma.placementClaimCashCall.findFirst({
      where: {
        id: cashCallId,
        tenantId: user.tenantId,
        placementId,
        claimId,
      },
      include: {
        allocation: true,
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
            email: true,
            phone: true,
            country: true,
          },
        },
      },
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }

    const snapshot = this.toJsonSafe(cashCall);
    return this.createGeneratedDocument(user, placementId, {
      type: PlacementDocumentType.CLAIM_CASH_CALL,
      prefix: 'DOC-CCL-',
      title: `Claim Cash Call ${cashCall.cashCallNumber}`,
      currency: cashCall.currency,
      sourceSnapshot: snapshot,
      renderPayload: {
        documentType: PlacementDocumentType.CLAIM_CASH_CALL,
        cashCall: snapshot,
      },
      sourceLinks: {
        claimId: cashCall.claimId,
        claimCashCallId: cashCall.id,
      },
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    documentId: string,
    dto: VoidPlacementDocumentDto,
  ): Promise<PlacementDocumentRecord> {
    const document = await this.findOne(user.tenantId, placementId, documentId);
    if (document.status === PlacementDocumentStatus.VOID) {
      throw new BadRequestException('VOID documents are terminal');
    }

    return this.prisma.placementDocument.update({
      where: { id: documentId },
      data: {
        status: PlacementDocumentStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: documentInclude,
    });
  }

  private async createGeneratedDocument(
    user: RequestUser,
    placementId: string,
    descriptor: DocumentSourceDescriptor,
  ): Promise<PlacementDocumentRecord> {
    await this.assertPlacement(user.tenantId, placementId);

    return this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.nextDocumentNumber(
        tx,
        user.tenantId,
        placementId,
        descriptor.prefix,
      );
      const version = await this.nextVersion(
        tx,
        user.tenantId,
        placementId,
        descriptor,
      );

      return tx.placementDocument.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          ...(descriptor.sourceLinks ?? {}),
          type: descriptor.type,
          status: PlacementDocumentStatus.GENERATED,
          documentNumber,
          version,
          title: descriptor.title,
          currency: descriptor.currency,
          sourceSnapshot: this.toJsonSafe(descriptor.sourceSnapshot),
          renderPayload: this.toJsonSafe(descriptor.renderPayload),
          generatedAt: new Date(),
          createdByUserId: user.id,
        },
        include: documentInclude,
      });
    });
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    prefix: string,
  ): Promise<string> {
    const count = await tx.placementDocument.count({
      where: {
        tenantId,
        placementId,
        documentNumber: { startsWith: prefix },
      },
    });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  private async nextVersion(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    descriptor: DocumentSourceDescriptor,
  ): Promise<number> {
    const count = await tx.placementDocument.count({
      where: {
        tenantId,
        placementId,
        type: descriptor.type,
        ...this.versionSourceWhere(descriptor.sourceLinks),
      },
    });
    return count + 1;
  }

  private versionSourceWhere(
    sourceLinks: DocumentSourceDescriptor['sourceLinks'],
  ): Prisma.PlacementDocumentWhereInput {
    if (!sourceLinks) return {};
    if (sourceLinks.noteId) return { noteId: sourceLinks.noteId };
    if (sourceLinks.closingId) return { closingId: sourceLinks.closingId };
    if (sourceLinks.endorsementClosingId) {
      return { endorsementClosingId: sourceLinks.endorsementClosingId };
    }
    if (sourceLinks.claimCashCallId) {
      return { claimCashCallId: sourceLinks.claimCashCallId };
    }
    if (sourceLinks.claimId) return { claimId: sourceLinks.claimId };
    if (sourceLinks.endorsementId) {
      return { endorsementId: sourceLinks.endorsementId };
    }
    return {};
  }

  private documentTypeForNote(note: {
    type: PlacementNoteType;
    noteNumber: string;
  }): PlacementDocumentType {
    const isEndorsementNote =
      note.noteNumber.startsWith('EDN-') || note.noteNumber.startsWith('ECN-');
    if (note.type === PlacementNoteType.DEBIT_NOTE) {
      return isEndorsementNote
        ? PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
        : PlacementDocumentType.DEBIT_NOTE;
    }
    return isEndorsementNote
      ? PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE
      : PlacementDocumentType.CREDIT_NOTE;
  }

  private prefixForDocumentType(type: PlacementDocumentType): string {
    const prefixes: Record<PlacementDocumentType, string> = {
      [PlacementDocumentType.OFFER_SLIP]: 'DOC-OS-',
      [PlacementDocumentType.CLOSING_SLIP]: 'DOC-CS-',
      [PlacementDocumentType.DEBIT_NOTE]: 'DOC-DN-',
      [PlacementDocumentType.CREDIT_NOTE]: 'DOC-CN-',
      [PlacementDocumentType.ENDORSEMENT_SLIP]: 'DOC-ES-',
      [PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE]: 'DOC-EDN-',
      [PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE]: 'DOC-ECN-',
      [PlacementDocumentType.CLAIM_CASH_CALL]: 'DOC-CCL-',
      [PlacementDocumentType.CLAIM_NOTICE]: 'DOC-CLM-',
    };
    return prefixes[type];
  }

  private titleForDocumentType(type: PlacementDocumentType): string {
    const titles: Record<PlacementDocumentType, string> = {
      [PlacementDocumentType.OFFER_SLIP]: 'Offer Slip',
      [PlacementDocumentType.CLOSING_SLIP]: 'Closing Slip',
      [PlacementDocumentType.DEBIT_NOTE]: 'Debit Note',
      [PlacementDocumentType.CREDIT_NOTE]: 'Credit Note',
      [PlacementDocumentType.ENDORSEMENT_SLIP]: 'Endorsement Slip',
      [PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE]: 'Endorsement Debit Note',
      [PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE]:
        'Endorsement Credit Note',
      [PlacementDocumentType.CLAIM_CASH_CALL]: 'Claim Cash Call',
      [PlacementDocumentType.CLAIM_NOTICE]: 'Claim Notice',
    };
    return titles[type];
  }

  private toJsonSafe(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value, (_key, item: unknown) => {
        if (item instanceof Prisma.Decimal) return item.toString();
        return item;
      }),
    ) as Prisma.InputJsonValue;
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }
}
