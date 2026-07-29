import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementClaimRecoveryReceiptDto } from './dto/create-placement-claim-recovery-receipt.dto';
import { ReversePlacementClaimRecoveryReceiptDto } from './dto/reverse-placement-claim-recovery-receipt.dto';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

const receiptInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  reversalReceipts: {
    select: { id: true },
  },
} satisfies Prisma.PlacementClaimRecoveryReceiptInclude;

const cashCallInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  allocation: {
    select: {
      id: true,
      allocatedEstimatedLossAmount: true,
      allocatedFinalLossAmount: true,
    },
  },
  recoveryReceipts: {
    include: receiptInclude,
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PlacementClaimCashCallInclude;

type RecoveryReceiptRecord = Prisma.PlacementClaimRecoveryReceiptGetPayload<{
  include: typeof receiptInclude;
}>;

type CashCallWithRecoveryRecords = Prisma.PlacementClaimCashCallGetPayload<{
  include: typeof cashCallInclude;
}>;

export type ClaimRecoveryStatus =
  | 'UNRECOVERED'
  | 'PARTIALLY_RECOVERED'
  | 'FULLY_RECOVERED';

export interface ClaimRecoveryPosition {
  claimId: string;
  placementId: string;
  currency: string;
  recoveries: {
    totalAllocated: string;
    totalCashCalled: string;
    totalRecovered: string;
    totalReversed: string;
    totalOutstanding: string;
  };
  perCashCall: Array<{
    cashCallId: string;
    allocationId: string;
    counterpartyId: string;
    counterparty: CashCallWithRecoveryRecords['counterparty'];
    cashCallNumber: string;
    cashCallStatus: PlacementClaimCashCallStatus;
    currency: string;
    calledAmount: string;
    recoveredAmount: string;
    reversedAmount: string;
    outstandingAmount: string;
    recoveryStatus: ClaimRecoveryStatus;
    receipts: RecoveryReceiptRecord[];
  }>;
  cedantSettlementStatus: string;
}

@Injectable()
export class PlacementClaimRecoveryReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<RecoveryReceiptRecord[]> {
    await this.assertCashCall(tenantId, placementId, claimId, cashCallId);
    return this.prisma.placementClaimRecoveryReceipt.findMany({
      where: { tenantId, placementId, claimId, cashCallId },
      include: receiptInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    user: RequestUser,
    placementId: string,
    claimId: string,
    cashCallId: string,
    dto: CreatePlacementClaimRecoveryReceiptDto,
  ): Promise<RecoveryReceiptRecord> {
    const currency = this.cleanCurrency(dto.currency);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const cashCall = await this.findCashCall(
              tx,
              user.tenantId,
              placementId,
              claimId,
              cashCallId,
            );
            this.assertCashCallReceivable(cashCall.status);

            if (currency !== cashCall.currency) {
              throw new BadRequestException(
                'Recovery receipt currency must match the cash call currency',
              );
            }

            const position = this.calculateCashCallPosition(cashCall);
            if (dto.amount > position.outstandingAmount) {
              throw new ConflictException(
                'Recovery receipt amount cannot exceed the outstanding recovery balance',
              );
            }

            return tx.placementClaimRecoveryReceipt.create({
              data: {
                tenantId: user.tenantId,
                placementId: cashCall.placementId,
                claimId: cashCall.claimId,
                allocationId: cashCall.allocationId,
                cashCallId: cashCall.id,
                counterpartyId: cashCall.counterpartyId,
                currency,
                amount: dto.amount,
                paymentDate: new Date(dto.paymentDate),
                reference: this.cleanOptional(dto.reference),
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimRecoveryReceiptStatus.RECORDED,
                createdByUserId: user.id,
              },
              include: receiptInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        if (this.isUniqueConstraintConflict(error)) {
          throw new ConflictException(
            'Recovery receipt has already been reversed',
          );
        }
        throw error;
      }
    }

    throw new ConflictException('Could not record recovery receipt');
  }

  async reverse(
    user: RequestUser,
    placementId: string,
    claimId: string,
    receiptId: string,
    dto: ReversePlacementClaimRecoveryReceiptDto,
  ): Promise<RecoveryReceiptRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const receipt = await tx.placementClaimRecoveryReceipt.findFirst({
              where: {
                id: receiptId,
                tenantId: user.tenantId,
                placementId,
                claimId,
              },
              include: receiptInclude,
            });
            if (!receipt) {
              throw new NotFoundException(
                'Placement claim recovery receipt not found',
              );
            }
            if (receipt.reversalOfReceiptId) {
              throw new BadRequestException(
                'Cannot reverse a reversal recovery receipt',
              );
            }
            if (
              receipt.status === PlacementClaimRecoveryReceiptStatus.REVERSED ||
              receipt.reversalReceipts.length > 0
            ) {
              throw new ConflictException(
                'Recovery receipt has already been reversed',
              );
            }

            await tx.placementClaimRecoveryReceipt.update({
              where: { id: receipt.id },
              data: { status: PlacementClaimRecoveryReceiptStatus.REVERSED },
            });

            return tx.placementClaimRecoveryReceipt.create({
              data: {
                tenantId: receipt.tenantId,
                placementId: receipt.placementId,
                claimId: receipt.claimId,
                allocationId: receipt.allocationId,
                cashCallId: receipt.cashCallId,
                counterpartyId: receipt.counterpartyId,
                currency: receipt.currency,
                amount: receipt.amount,
                paymentDate: new Date(),
                reference: receipt.reference
                  ? `REVERSAL:${receipt.reference}`
                  : null,
                notes: this.cleanOptional(dto.notes),
                status: PlacementClaimRecoveryReceiptStatus.RECORDED,
                reversalOfReceiptId: receipt.id,
                createdByUserId: user.id,
              },
              include: receiptInclude,
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

    throw new ConflictException('Could not reverse recovery receipt');
  }

  async getRecoveryPosition(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<ClaimRecoveryPosition> {
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
      select: { id: true, placementId: true, currency: true },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');

    const cashCalls = await this.prisma.placementClaimCashCall.findMany({
      where: { tenantId, placementId, claimId },
      include: cashCallInclude,
      orderBy: { createdAt: 'asc' },
    });

    const perCashCall = cashCalls.map((cashCall) => {
      const position = this.calculateCashCallPosition(cashCall);
      return {
        cashCallId: cashCall.id,
        allocationId: cashCall.allocationId,
        counterpartyId: cashCall.counterpartyId,
        counterparty: cashCall.counterparty,
        cashCallNumber: cashCall.cashCallNumber,
        cashCallStatus: cashCall.status,
        currency: cashCall.currency,
        calledAmount: this.formatMoney(cashCall.amount),
        recoveredAmount: this.formatMoney(position.recoveredAmount),
        reversedAmount: this.formatMoney(position.reversedAmount),
        outstandingAmount: this.formatMoney(position.outstandingAmount),
        recoveryStatus: position.recoveryStatus,
        receipts: cashCall.recoveryReceipts,
      };
    });

    const totalAllocated = cashCalls.reduce(
      (sum, cashCall) =>
        sum +
        this.money.toNumber(
          cashCall.allocation.allocatedFinalLossAmount ??
            cashCall.allocation.allocatedEstimatedLossAmount,
        ),
      0,
    );
    const effectiveCashCalls = cashCalls.filter((cashCall) =>
      this.isRecoverableCashCallStatus(cashCall.status),
    );
    const totalCashCalled = effectiveCashCalls.reduce(
      (sum, cashCall) => sum + this.money.toNumber(cashCall.amount),
      0,
    );
    const totalRecovered = perCashCall.reduce(
      (sum, row) => sum + Number(row.recoveredAmount),
      0,
    );
    const totalReversed = perCashCall.reduce(
      (sum, row) => sum + Number(row.reversedAmount),
      0,
    );
    const totalOutstanding = perCashCall.reduce(
      (sum, row) => sum + Number(row.outstandingAmount),
      0,
    );

    return {
      claimId: claim.id,
      placementId: claim.placementId,
      currency: claim.currency,
      recoveries: {
        totalAllocated: this.formatMoney(totalAllocated),
        totalCashCalled: this.formatMoney(totalCashCalled),
        totalRecovered: this.formatMoney(totalRecovered),
        totalReversed: this.formatMoney(totalReversed),
        totalOutstanding: this.formatMoney(totalOutstanding),
      },
      perCashCall,
      cedantSettlementStatus:
        'Cedant claim settlement is deferred pending approval of the settlement basis.',
    };
  }

  async hasEffectiveReceipts(
    tenantId: string,
    cashCallId: string,
  ): Promise<boolean> {
    const receipt = await this.prisma.placementClaimRecoveryReceipt.findFirst({
      where: {
        tenantId,
        cashCallId,
        status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        reversalOfReceiptId: null,
      },
      select: { id: true },
    });
    return !!receipt;
  }

  private async assertCashCall(
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<void> {
    await this.findCashCall(
      this.prisma,
      tenantId,
      placementId,
      claimId,
      cashCallId,
    );
  }

  private async findCashCall(
    prisma: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    placementId: string,
    claimId: string,
    cashCallId: string,
  ): Promise<CashCallWithRecoveryRecords> {
    const placement = await prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    const cashCall = await prisma.placementClaimCashCall.findFirst({
      where: {
        id: cashCallId,
        tenantId,
        placementId,
        claimId,
      },
      include: cashCallInclude,
    });
    if (!cashCall) {
      throw new NotFoundException('Placement claim cash call not found');
    }
    return cashCall;
  }

  private assertCashCallReceivable(status: PlacementClaimCashCallStatus): void {
    if (status !== PlacementClaimCashCallStatus.ISSUED) {
      throw new BadRequestException(
        'Only issued claim cash calls can receive recovery receipts',
      );
    }
  }

  private calculateCashCallPosition(cashCall: CashCallWithRecoveryRecords) {
    const calledAmount = this.money.toNumber(cashCall.amount);
    const isRecoverable = this.isRecoverableCashCallStatus(cashCall.status);
    const activeReceipts = cashCall.recoveryReceipts.filter(
      (receipt) =>
        receipt.status === PlacementClaimRecoveryReceiptStatus.RECORDED &&
        !receipt.reversalOfReceiptId,
    );
    const reversalReceipts = cashCall.recoveryReceipts.filter(
      (receipt) => !!receipt.reversalOfReceiptId,
    );
    const recoveredAmount = this.money.roundMoney(
      activeReceipts.reduce(
        (sum, receipt) => sum + this.money.toNumber(receipt.amount),
        0,
      ),
    );
    const reversedAmount = this.money.roundMoney(
      reversalReceipts.reduce(
        (sum, receipt) => sum + this.money.toNumber(receipt.amount),
        0,
      ),
    );
    const outstandingAmount = Math.max(
      0,
      this.money.roundMoney(isRecoverable ? calledAmount - recoveredAmount : 0),
    );
    const recoveryStatus: ClaimRecoveryStatus =
      recoveredAmount <= 0
        ? 'UNRECOVERED'
        : outstandingAmount <= 0
          ? 'FULLY_RECOVERED'
          : 'PARTIALLY_RECOVERED';

    return {
      recoveredAmount,
      reversedAmount,
      outstandingAmount,
      recoveryStatus,
    };
  }

  private isRecoverableCashCallStatus(
    status: PlacementClaimCashCallStatus,
  ): boolean {
    return (
      status === PlacementClaimCashCallStatus.ISSUED ||
      status === PlacementClaimCashCallStatus.PAID
    );
  }

  private formatMoney(value: Prisma.Decimal | number | string): string {
    return this.money.roundMoney(this.money.toNumber(value)).toFixed(2);
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

  private isUniqueConstraintConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
