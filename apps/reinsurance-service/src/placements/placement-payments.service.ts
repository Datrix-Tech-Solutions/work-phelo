import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementPaymentDto } from './dto/create-placement-payment.dto';

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
} satisfies Prisma.PlacementPaymentInclude;

type PlacementPaymentRecord = Prisma.PlacementPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PlacementPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const currency = this.cleanCurrency(dto.currency);
    if (!placement.currency) {
      throw new BadRequestException(
        'Placement currency is required before recording payment',
      );
    }
    if (currency !== placement.currency) {
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

    await this.assertConfirmedClosingExists(user.tenantId, placementId);

    if (dto.type === PlacementPaymentType.PREMIUM_RECEIVED) {
      this.assertPremiumReceived(placement.cedantId, counterparty.id, dto);
    } else if (dto.type === PlacementPaymentType.REINSURER_DISBURSEMENT) {
      await this.assertReinsurerDisbursement(
        user.tenantId,
        placementId,
        counterparty,
        dto,
      );
    } else {
      throw new BadRequestException(
        'Claim settlement payments are deferred until claims are implemented',
      );
    }

    return this.prisma.placementPayment.create({
      data: {
        tenantId: user.tenantId,
        placementId,
        closingId: dto.closingId,
        participantId: dto.participantId,
        counterpartyId: dto.counterpartyId,
        type: dto.type,
        direction: dto.direction,
        amount: dto.amount,
        currency,
        paymentDate: new Date(dto.paymentDate),
        reference: this.cleanOptional(dto.reference),
        notes: this.cleanOptional(dto.notes),
        status: PlacementPaymentStatus.RECORDED,
        createdByUserId: user.id,
      },
      include: paymentInclude,
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

    return this.prisma.$transaction(async (tx) => {
      await tx.placementPayment.update({
        where: { id: payment.id },
        data: { status: PlacementPaymentStatus.REVERSED },
      });

      return tx.placementPayment.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId: payment.closingId,
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
          notes: 'Payment reversal',
          status: PlacementPaymentStatus.RECORDED,
          reversalOfPaymentId: payment.id,
          createdByUserId: user.id,
        },
        include: paymentInclude,
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

  private async assertConfirmedClosingExists(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const closing = await this.prisma.placementClosing.findFirst({
      where: {
        tenantId,
        placementId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: { id: true },
    });
    if (!closing) {
      throw new BadRequestException(
        'At least one confirmed closing is required before recording payment',
      );
    }
  }

  private assertPremiumReceived(
    cedantId: string,
    counterpartyId: string,
    dto: CreatePlacementPaymentDto,
  ): void {
    if (dto.direction !== PlacementPaymentDirection.INBOUND) {
      throw new BadRequestException('Premium received must be INBOUND');
    }
    if (dto.counterpartyId !== cedantId || counterpartyId !== cedantId) {
      throw new BadRequestException(
        'Premium received counterparty must be the placement cedant',
      );
    }
    if (dto.closingId || dto.participantId) {
      throw new BadRequestException(
        'Premium received is placement-level; omit closingId and participantId',
      );
    }
  }

  private async assertReinsurerDisbursement(
    tenantId: string,
    placementId: string,
    counterparty: { id: string; type: CounterpartyType },
    dto: CreatePlacementPaymentDto,
  ): Promise<void> {
    if (dto.direction !== PlacementPaymentDirection.OUTBOUND) {
      throw new BadRequestException('Reinsurer disbursement must be OUTBOUND');
    }
    if (counterparty.type !== CounterpartyType.REINSURER) {
      throw new BadRequestException(
        'Reinsurer disbursement counterparty must be a reinsurer',
      );
    }
    if (!dto.closingId || !dto.participantId) {
      throw new BadRequestException(
        'Reinsurer disbursement requires closingId and participantId',
      );
    }

    const closing = await this.prisma.placementClosing.findFirst({
      where: {
        id: dto.closingId,
        tenantId,
        placementId,
        participantId: dto.participantId,
        status: PlacementClosingStatus.CONFIRMED,
      },
      include: {
        participant: {
          select: {
            id: true,
            counterpartyId: true,
          },
        },
      },
    });

    if (!closing) {
      throw new BadRequestException(
        'Reinsurer disbursement requires a matching confirmed closing',
      );
    }
    if (closing.participant.counterpartyId !== counterparty.id) {
      throw new BadRequestException(
        'Payment counterparty must match the closing participant reinsurer',
      );
    }
  }

  private cleanCurrency(value: string): string {
    return value.trim().toUpperCase();
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
