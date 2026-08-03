import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimCedantSettlementStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovePlacementClaimPayableDto } from './dto/approve-placement-claim-payable.dto';
import { CreatePlacementClaimCedantSettlementDto } from './dto/create-placement-claim-cedant-settlement.dto';
import { ReversePlacementClaimCedantSettlementDto } from './dto/reverse-placement-claim-cedant-settlement.dto';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

const cedantSettlementInclude = {
  reversalSettlements: {
    select: { id: true },
  },
} satisfies Prisma.PlacementClaimCedantSettlementInclude;

type CedantSettlementRecord = Prisma.PlacementClaimCedantSettlementGetPayload<{
  include: typeof cedantSettlementInclude;
}>;

type ClaimApprovalRecord = Prisma.PlacementClaimGetPayload<object>;

export type ClaimCedantSettlementStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED_UNSETTLED'
  | 'PARTIALLY_SETTLED'
  | 'SETTLED';

export interface ClaimCedantSettlementPosition {
  finalLossAmount: string | null;
  approvedPayableAmount: string | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  settledAmount: string;
  reversedAmount: string;
  outstandingAmount: string;
  settlementStatus: ClaimCedantSettlementStatus;
}

@Injectable()
export class PlacementClaimCedantSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async approvePayable(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: ApprovePlacementClaimPayableDto,
  ): Promise<ClaimApprovalRecord> {
    const approvedAmount = this.money.roundMoney(dto.approvedPayableAmount);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            this.assertClaimCanBeApproved(claim);

            const finalLossAmount = this.money.toOptionalNumber(
              claim.finalLossAmount,
            );
            if (finalLossAmount === null) {
              throw new BadRequestException(
                'Final loss amount is required before approving cedant payable amount',
              );
            }
            if (approvedAmount > finalLossAmount) {
              throw new BadRequestException(
                'Approved payable amount cannot exceed the final loss amount',
              );
            }

            const position = await this.calculatePosition(
              tx,
              user.tenantId,
              placementId,
              claimId,
              approvedAmount,
              claim,
            );
            const settledAmount = Number(position.settledAmount);
            if (approvedAmount < settledAmount) {
              throw new ConflictException(
                'Approved payable amount cannot be lower than the amount already settled to the cedant',
              );
            }

            return tx.placementClaim.update({
              where: { id: claimId },
              data: {
                approvedPayableAmount: approvedAmount,
                approvedAt: new Date(),
                approvedByUserId: user.id,
                updatedByUserId: user.id,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not approve claim payable amount');
  }

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<CedantSettlementRecord[]> {
    await this.findClaim(this.prisma, tenantId, placementId, claimId);
    return this.prisma.placementClaimCedantSettlement.findMany({
      where: { tenantId, placementId, claimId },
      include: cedantSettlementInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: CreatePlacementClaimCedantSettlementDto,
  ): Promise<CedantSettlementRecord> {
    const currency = this.cleanCurrency(dto.currency);
    const amount = this.money.roundMoney(dto.amount);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const claim = await this.findClaim(
              tx,
              user.tenantId,
              placementId,
              claimId,
            );
            this.assertClaimCanBeSettled(claim);

            if (currency !== claim.currency) {
              throw new BadRequestException(
                'Cedant settlement currency must match the claim currency',
              );
            }

            const approvedPayableAmount = this.money.toOptionalNumber(
              claim.approvedPayableAmount,
            );
            if (approvedPayableAmount === null) {
              throw new BadRequestException(
                'Approved payable amount is required before recording cedant settlement',
              );
            }

            const position = await this.calculatePosition(
              tx,
              user.tenantId,
              placementId,
              claimId,
              approvedPayableAmount,
              claim,
            );
            if (amount > Number(position.outstandingAmount)) {
              throw new ConflictException(
                'Cedant settlement amount cannot exceed the outstanding approved payable balance',
              );
            }

            return tx.placementClaimCedantSettlement.create({
              data: {
                tenantId: user.tenantId,
                placementId: claim.placementId,
                claimId: claim.id,
                currency,
                amount,
                settlementDate: new Date(dto.settlementDate),
                reference: this.cleanOptional(dto.reference),
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimCedantSettlementStatus.RECORDED,
                createdByUserId: user.id,
              },
              include: cedantSettlementInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not record cedant settlement');
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    claimId: string,
    settlementId: string,
    dto: ReversePlacementClaimCedantSettlementDto,
  ): Promise<CedantSettlementRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const settlement =
              await tx.placementClaimCedantSettlement.findFirst({
                where: {
                  id: settlementId,
                  tenantId: user.tenantId,
                  placementId,
                  claimId,
                },
                include: cedantSettlementInclude,
              });
            if (!settlement) {
              throw new NotFoundException(
                'Placement claim cedant settlement not found',
              );
            }
            if (settlement.reversalOfSettlementId) {
              throw new BadRequestException(
                'Cannot reverse a reversal cedant settlement',
              );
            }
            if (
              settlement.status ===
                PlacementClaimCedantSettlementStatus.REVERSED ||
              settlement.reversalSettlements.length > 0
            ) {
              throw new ConflictException(
                'Cedant settlement has already been reversed',
              );
            }

            await tx.placementClaimCedantSettlement.update({
              where: { id: settlement.id },
              data: { status: PlacementClaimCedantSettlementStatus.REVERSED },
            });

            return tx.placementClaimCedantSettlement.create({
              data: {
                tenantId: settlement.tenantId,
                placementId: settlement.placementId,
                claimId: settlement.claimId,
                currency: settlement.currency,
                amount: settlement.amount,
                settlementDate: new Date(),
                reference: settlement.reference
                  ? `REVERSAL:${settlement.reference}`
                  : null,
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimCedantSettlementStatus.RECORDED,
                reversalOfSettlementId: settlement.id,
                createdByUserId: user.id,
              },
              include: cedantSettlementInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Could not reverse cedant settlement');
  }

  async getPosition(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimCedantSettlementPosition> {
    const claim = await this.findClaim(
      this.prisma,
      tenantId,
      placementId,
      claimId,
    );
    const approvedPayableAmount = this.money.toOptionalNumber(
      claim.approvedPayableAmount,
    );
    return this.calculatePosition(
      this.prisma,
      tenantId,
      placementId,
      claimId,
      approvedPayableAmount,
      claim,
    );
  }

  async calculatePosition(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    approvedPayableAmount: number | null,
    claim?: ClaimApprovalRecord,
  ): Promise<ClaimCedantSettlementPosition> {
    const claimRecord =
      claim ?? (await this.findClaim(prisma, tenantId, placementId, claimId));
    const settlements = await prisma.placementClaimCedantSettlement.findMany({
      where: { tenantId, placementId, claimId },
      select: {
        amount: true,
        status: true,
        reversalOfSettlementId: true,
      },
    });
    const settledAmount = this.money.roundMoney(
      settlements
        .filter(
          (settlement) =>
            settlement.status ===
              PlacementClaimCedantSettlementStatus.RECORDED &&
            !settlement.reversalOfSettlementId,
        )
        .reduce(
          (sum, settlement) => sum + this.money.toNumber(settlement.amount),
          0,
        ),
    );
    const reversedAmount = this.money.roundMoney(
      settlements
        .filter((settlement) => !!settlement.reversalOfSettlementId)
        .reduce(
          (sum, settlement) => sum + this.money.toNumber(settlement.amount),
          0,
        ),
    );
    const approved = approvedPayableAmount;
    const outstandingAmount =
      approved === null
        ? 0
        : Math.max(0, this.money.roundMoney(approved - settledAmount));
    const settlementStatus: ClaimCedantSettlementStatus =
      approved === null
        ? 'PENDING_APPROVAL'
        : settledAmount <= 0
          ? 'APPROVED_UNSETTLED'
          : outstandingAmount <= 0
            ? 'SETTLED'
            : 'PARTIALLY_SETTLED';

    return {
      finalLossAmount: this.formatOptionalMoney(claimRecord.finalLossAmount),
      approvedPayableAmount:
        approved === null ? null : this.formatMoney(approved),
      approvedAt: claimRecord.approvedAt,
      approvedByUserId: claimRecord.approvedByUserId,
      settledAmount: this.formatMoney(settledAmount),
      reversedAmount: this.formatMoney(reversedAmount),
      outstandingAmount: this.formatMoney(outstandingAmount),
      settlementStatus,
    };
  }

  private async findClaim(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimApprovalRecord> {
    const placement = await prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const claim = await prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
    return claim;
  }

  private assertClaimCanBeApproved(claim: ClaimApprovalRecord): void {
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.DECLINED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException(
        'Terminal claims cannot have payable amount approved',
      );
    }
  }

  private assertClaimCanBeSettled(claim: ClaimApprovalRecord): void {
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.DECLINED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException('Terminal claims cannot be settled');
    }
  }

  private formatMoney(value: Prisma.Decimal | number | string): string {
    return this.money.roundMoney(this.money.toNumber(value)).toFixed(2);
  }

  private formatOptionalMoney(
    value: Prisma.Decimal | number | string | null,
  ): string | null {
    return value === null ? null : this.formatMoney(value);
  }

  private cleanCurrency(value: string): string {
    return this.cleanRequired(value).toUpperCase();
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
