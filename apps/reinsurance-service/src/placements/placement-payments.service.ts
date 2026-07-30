import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { ReinsuranceFinancialEventPublisher } from '../accounting-integration/reinsurance-financial-event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementPaymentDto } from './dto/create-placement-payment.dto';
import { PlacementFinancialPositionService } from './placement-financial-position.service';

const paymentInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  participant: {
    select: {
      id: true,
      counterpartyId: true,
    },
  },
  closing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  allocations: {
    include: {
      note: {
        select: {
          id: true,
          noteNumber: true,
          type: true,
          currency: true,
          status: true,
          direction: true,
          netAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlacementPaymentInclude;

const paymentEventPlacementSelect = {
  id: true,
  reference: true,
  policyNumber: true,
  title: true,
  cedantId: true,
} satisfies Prisma.PlacementSelect;

type PlacementPaymentRecord = Prisma.PlacementPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

type ValidatedDisbursementAllocation = {
  tenantId: string;
  placementId: string;
  noteId: string;
  allocatedAmount: Prisma.Decimal;
  allocatedCurrency: string;
  obligationAmount: Prisma.Decimal;
  obligationCurrency: string;
  agreedExchangeRate: Prisma.Decimal | null;
  createdByUserId: string;
};

@Injectable()
export class PlacementPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPositionService: PlacementFinancialPositionService,
    private readonly financialEvents: ReinsuranceFinancialEventPublisher,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementPaymentRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementPayment.findMany({
      where: { tenantId, placementId },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    paymentId: string,
  ): Promise<PlacementPaymentRecord> {
    await this.assertPlacement(tenantId, placementId);
    const payment = await this.prisma.placementPayment.findFirst({
      where: { id: paymentId, tenantId, placementId },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('Placement payment not found');
    return payment;
  }

  async create(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementPaymentDto,
  ): Promise<PlacementPaymentRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      select: {
        id: true,
        tenantId: true,
        cedantId: true,
        currency: true,
        reference: true,
        policyNumber: true,
        title: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const currency = this.cleanCurrency(dto.currency);
    if (!placement.currency) {
      throw new BadRequestException(
        'Placement currency is required before recording payment',
      );
    }
    if (
      dto.type !== PlacementPaymentType.REINSURER_DISBURSEMENT &&
      currency !== placement.currency
    ) {
      throw new BadRequestException(
        'Payment currency must match placement currency',
      );
    }

    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: dto.counterpartyId,
        tenantId: user.tenantId,
        archivedAt: null,
      },
      select: { id: true, type: true },
    });
    if (!counterparty) throw new NotFoundException('Counterparty not found');

    let disbursementAllocations: ValidatedDisbursementAllocation[] = [];

    if (dto.type === PlacementPaymentType.PREMIUM_RECEIVED) {
      await this.assertPremiumReceived(
        user.tenantId,
        placementId,
        placement.cedantId,
        counterparty.id,
        currency,
        dto,
      );
    } else if (dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT) {
      disbursementAllocations = await this.assertReinsurerDisbursement(
        user.tenantId,
        placementId,
        counterparty,
        dto,
        user.id,
      );
    } else {
      throw new BadRequestException(
        'Claim settlement payments are deferred until claims are implemented',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.placementPayment.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId: dto.closingId,
          endorsementClosingId: dto.endorsementClosingId,
          participantId: dto.participantId,
          counterpartyId: dto.counterpartyId,
          type: dto.type,
          direction: dto.direction,
          amount: dto.amount,
          currency,
          paymentDate: new Date(dto.paymentDate),
          reference: this.cleanOptional(dto.reference),
          settlementReference: this.cleanOptional(dto.settlementReference),
          bankReference: this.cleanOptional(dto.bankReference),
          bankConfirmedAt:
            dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT
              ? new Date(dto.bankConfirmedAt as string)
              : null,
          bankConfirmedByUserId:
            dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT
              ? user.id
              : null,
          agreedExchangeRate: dto.agreedExchangeRate ?? null,
          bankChargeAmount: dto.bankChargeAmount ?? 0,
          withholdingTaxAmount: dto.withholdingTaxAmount ?? 0,
          notes: this.cleanOptional(dto.notes),
          status:
            dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT
              ? PlacementPaymentStatus.BANK_CONFIRMED
              : PlacementPaymentStatus.RECORDED,
          createdByUserId: user.id,
          ...(disbursementAllocations.length
            ? {
                allocations: {
                  create: disbursementAllocations,
                },
              }
            : {}),
        },
        include: paymentInclude,
      });

      if (dto.type === PlacementPaymentType.PREMIUM_RECEIVED) {
        const event = this.financialEvents.preparePremiumPaymentReceived(user, {
          ...payment,
          placement,
        });
        if (event) {
          await this.financialEvents.enqueuePreparedEvent(tx, event);
        }
      } else if (dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT) {
        const event = this.financialEvents.prepareReinsurerDisbursementRecorded(
          user,
          {
            ...payment,
            placement,
          },
        );
        if (event) {
          await this.financialEvents.enqueuePreparedEvent(tx, event);
        }
      }

      return payment;
    });
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    paymentId: string,
  ): Promise<PlacementPaymentRecord> {
    const payment = await this.findOne(user.tenantId, placementId, paymentId);

    if (payment.reversalOfPaymentId) {
      throw new BadRequestException('Cannot reverse a reversal payment');
    }
    if (payment.status === PlacementPaymentStatus.REVERSED) {
      throw new ConflictException('Payment has already been reversed');
    }

    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      select: paymentEventPlacementSelect,
    });
    if (!placement) throw new NotFoundException('Placement not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.placementPayment.update({
        where: { id: payment.id },
        data: { status: PlacementPaymentStatus.REVERSED },
      });

      const reversal = await tx.placementPayment.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId: payment.closingId,
          endorsementClosingId: payment.endorsementClosingId,
          participantId: payment.participantId,
          counterpartyId: payment.counterpartyId,
          type: payment.type,
          direction: payment.direction,
          amount: payment.amount.negated(),
          currency: payment.currency,
          paymentDate: new Date(),
          reference: payment.reference
            ? `REVERSAL-${payment.reference}`
            : `REVERSAL-${payment.id}`,
          settlementReference: payment.settlementReference
            ? `REVERSAL-${payment.settlementReference}`
            : null,
          bankReference: payment.bankReference
            ? `REVERSAL-${payment.bankReference}`
            : null,
          bankConfirmedAt: null,
          bankConfirmedByUserId: null,
          agreedExchangeRate: payment.agreedExchangeRate,
          bankChargeAmount: payment.bankChargeAmount.negated(),
          withholdingTaxAmount: payment.withholdingTaxAmount.negated(),
          notes: 'Payment reversal',
          status: PlacementPaymentStatus.RECORDED,
          reversalOfPaymentId: payment.id,
          createdByUserId: user.id,
          ...(payment.allocations.length
            ? {
                allocations: {
                  create: payment.allocations.map((allocation) => ({
                    tenantId: user.tenantId,
                    placementId,
                    noteId: allocation.noteId,
                    allocatedAmount: allocation.allocatedAmount.negated(),
                    allocatedCurrency: allocation.allocatedCurrency,
                    obligationAmount: allocation.obligationAmount.negated(),
                    obligationCurrency: allocation.obligationCurrency,
                    agreedExchangeRate: allocation.agreedExchangeRate,
                    createdByUserId: user.id,
                  })),
                },
              }
            : {}),
        },
        include: paymentInclude,
      });

      if (payment.type === PlacementPaymentType.PREMIUM_RECEIVED) {
        const event = this.financialEvents.preparePaymentReversed(user, {
          ...reversal,
          placement,
          reversalOfPayment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            paymentDate: payment.paymentDate,
            reference: payment.reference,
            status: PlacementPaymentStatus.REVERSED,
          },
        });
        if (event) {
          await this.financialEvents.enqueuePreparedEvent(tx, event);
        }
      }

      return reversal;
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

  private async effectiveRecordedPaymentsTotal(where: {
    tenantId: string;
    placementId: string;
    type: PlacementPaymentType;
    currency: string;
    closingId?: string;
    participantId?: string;
  }): Promise<number> {
    const payments = await this.prisma.placementPayment.findMany({
      where: {
        ...where,
        status: {
          in: [
            PlacementPaymentStatus.RECORDED,
            PlacementPaymentStatus.BANK_CONFIRMED,
          ],
        },
        reversalOfPaymentId: null,
      },
      select: { amount: true },
    });

    return payments.reduce(
      (total, payment) => total + this.decimalToNumber(payment.amount),
      0,
    );
  }

  private assertDoesNotExceedOutstanding(
    amount: number,
    outstanding: number,
    message: string,
  ): void {
    if (amount > Math.max(0, outstanding) + 0.0001) {
      throw new ConflictException(message);
    }
  }

  private async assertPremiumReceived(
    tenantId: string,
    placementId: string,
    cedantId: string,
    counterpartyId: string,
    currency: string,
    dto: CreatePlacementPaymentDto,
  ): Promise<void> {
    if (dto.direction !== PlacementPaymentDirection.INBOUND) {
      throw new BadRequestException('Premium received must be INBOUND');
    }
    if (dto.counterpartyId !== cedantId || counterpartyId !== cedantId) {
      throw new BadRequestException(
        'Premium received counterparty must be the placement cedant',
      );
    }
    if (dto.closingId || dto.endorsementClosingId || dto.participantId) {
      throw new BadRequestException(
        'Premium received is placement-level; omit closingId, endorsementClosingId and participantId',
      );
    }

    const position = await this.financialPositionService.getFinancialPosition(
      tenantId,
      placementId,
      new Date(dto.paymentDate),
    );
    if (position.isMultiCurrency || position.currency !== currency) {
      throw new BadRequestException(
        'Financial position currency must match the payment currency',
      );
    }
    if (position.cedant.currentObligation <= 0) {
      throw new BadRequestException(
        'At least one confirmed closing is required before recording payment',
      );
    }
    this.assertDoesNotExceedOutstanding(
      dto.amount,
      position.cedant.outstanding,
      'Premium received exceeds the outstanding current effective premium',
    );
  }

  private async assertReinsurerDisbursement(
    tenantId: string,
    placementId: string,
    counterparty: { id: string; type: CounterpartyType },
    dto: CreatePlacementPaymentDto,
    userId: string,
  ): Promise<ValidatedDisbursementAllocation[]> {
    if (dto.direction !== PlacementPaymentDirection.OUTBOUND) {
      throw new BadRequestException('Reinsurer disbursement must be OUTBOUND');
    }
    if (counterparty.type !== CounterpartyType.REINSURER) {
      throw new BadRequestException(
        'Reinsurer disbursement counterparty must be a reinsurer',
      );
    }
    if (!dto.bankConfirmedAt) {
      throw new BadRequestException(
        'Reinsurer disbursement requires bankConfirmedAt because bank confirmation is the approved recognition boundary',
      );
    }
    if (!this.cleanOptional(dto.bankReference)) {
      throw new BadRequestException(
        'Reinsurer disbursement requires a bankReference',
      );
    }
    if (dto.closingId || dto.endorsementClosingId || dto.participantId) {
      throw new BadRequestException(
        'Reinsurer disbursement settlement sources must be supplied through allocations, not placement-level closing fields',
      );
    }
    if (!dto.allocations?.length) {
      throw new BadRequestException(
        'Reinsurer disbursement requires at least one credit-note allocation',
      );
    }

    return this.validateReinsurerDisbursementAllocations(
      tenantId,
      placementId,
      counterparty.id,
      dto,
      userId,
    );
  }

  private async validateReinsurerDisbursementAllocations(
    tenantId: string,
    placementId: string,
    counterpartyId: string,
    dto: CreatePlacementPaymentDto,
    userId: string,
  ): Promise<ValidatedDisbursementAllocation[]> {
    const allocations = dto.allocations ?? [];
    const uniqueNoteIds = new Set(
      allocations.map((allocation) => allocation.noteId),
    );
    if (uniqueNoteIds.size !== allocations.length) {
      throw new BadRequestException(
        'Reinsurer disbursement allocations must not duplicate credit notes',
      );
    }

    const paymentCurrency = this.cleanCurrency(dto.currency);
    const notes = await this.prisma.placementNote.findMany({
      where: {
        id: { in: [...uniqueNoteIds] },
        tenantId,
        placementId,
        counterpartyId,
        status: PlacementNoteStatus.ISSUED,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        type: {
          in: [
            PlacementNoteType.CREDIT_NOTE,
            PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          ],
        },
      },
      select: {
        id: true,
        currency: true,
        netAmount: true,
      },
    });

    if (notes.length !== uniqueNoteIds.size) {
      throw new BadRequestException(
        'Reinsurer disbursement allocations must reference issued credit notes for the payment reinsurer',
      );
    }

    const notesById = new Map(notes.map((note) => [note.id, note]));
    const allocationCreates: ValidatedDisbursementAllocation[] = [];
    let allocatedTotal = new Prisma.Decimal(0);

    for (const allocation of allocations) {
      const note = notesById.get(allocation.noteId);
      if (!note) continue;
      const obligationCurrency = this.cleanCurrency(note.currency);
      const requiresFx = obligationCurrency !== paymentCurrency;
      if (requiresFx && !dto.agreedExchangeRate) {
        throw new BadRequestException(
          'Reinsurer disbursement requires agreedExchangeRate when payment currency differs from credit-note currency',
        );
      }
      if (requiresFx && !allocation.obligationAmount) {
        throw new BadRequestException(
          'Reinsurer disbursement requires obligationAmount when payment currency differs from credit-note currency',
        );
      }
      const allocatedAmount = new Prisma.Decimal(allocation.allocatedAmount);
      const obligationAmount = new Prisma.Decimal(
        allocation.obligationAmount ?? allocation.allocatedAmount,
      );
      allocatedTotal = allocatedTotal.plus(allocatedAmount);
      allocationCreates.push({
        tenantId,
        placementId,
        noteId: allocation.noteId,
        allocatedAmount,
        allocatedCurrency: paymentCurrency,
        obligationAmount,
        obligationCurrency,
        agreedExchangeRate: requiresFx
          ? new Prisma.Decimal(dto.agreedExchangeRate as number)
          : dto.agreedExchangeRate
            ? new Prisma.Decimal(dto.agreedExchangeRate)
            : null,
        createdByUserId: userId,
      });
    }

    if (!allocatedTotal.equals(new Prisma.Decimal(dto.amount))) {
      throw new BadRequestException(
        'Reinsurer disbursement allocated amounts must equal the payment amount; unallocated payments are not supported',
      );
    }

    return allocationCreates;
  }

  private cleanCurrency(value: string): string {
    return value.trim().toUpperCase();
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private decimalToNumber(
    value: Prisma.Decimal | number | string | null,
  ): number {
    if (value === null) return 0;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
