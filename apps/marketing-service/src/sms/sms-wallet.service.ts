import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingSmsCreditLedgerEntryType,
  MarketingSmsCreditReservation,
  MarketingSmsWallet,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GrantSmsCreditsDto,
  QuerySmsLedgerDto,
} from './dto/sms-sender-identity.dto';

type WalletBalances = Pick<
  MarketingSmsWallet,
  'id' | 'availableCredits' | 'reservedCredits'
>;
type Tx = Prisma.TransactionClient;

const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient SMS credits';
const PLATFORM_GRANT_MESSAGE =
  'Only platform administrators can grant SMS credits';

@Injectable()
export class SmsWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(tenantId: string) {
    const wallet = await this.ensureWallet(tenantId);
    return this.toBalance(wallet);
  }

  async listLedger(tenantId: string, query: QuerySmsLedgerDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const wallet = await this.ensureWallet(tenantId);
    const where = { tenantId, walletId: wallet.id };
    const [total, entries] = await Promise.all([
      this.prisma.marketingSmsCreditLedgerEntry.count({ where }),
      this.prisma.marketingSmsCreditLedgerEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        credits: entry.credits,
        availableBefore: entry.availableBefore,
        availableAfter: entry.availableAfter,
        reservedBefore: entry.reservedBefore,
        reservedAfter: entry.reservedAfter,
        campaignId: entry.campaignId,
        recipientId: entry.recipientId,
        reservationId: entry.reservationId,
        reason: entry.reason,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async grantCredits(user: RequestUser, dto: GrantSmsCreditsDto) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(PLATFORM_GRANT_MESSAGE);
    }
    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.ensureWallet(user.tenantId, tx);
      if (dto.idempotencyKey) {
        const existing = await tx.marketingSmsCreditLedgerEntry.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (existing)
          return this.toBalance(await this.lockWallet(tx, wallet.id));
      }

      const locked = await this.lockWallet(tx, wallet.id);
      const updated = await tx.marketingSmsWallet.update({
        where: { id: wallet.id },
        data: { availableCredits: { increment: dto.credits } },
      });
      await this.createLedger(tx, {
        tenantId: user.tenantId,
        walletId: wallet.id,
        type: 'ADMIN_GRANT',
        credits: dto.credits,
        before: locked,
        after: updated,
        idempotencyKey: dto.idempotencyKey,
        reason: dto.reason,
        createdBy: user.id,
      });
      return this.toBalance(updated);
    });
  }

  async reserveCredits(input: {
    tenantId: string;
    campaignId?: string;
    credits: number;
    idempotencyKey: string;
    expiresAt?: Date;
  }) {
    if (input.credits <= 0)
      throw new BadRequestException('Credits must be positive');
    return this.prisma.$transaction((tx) =>
      this.reserveCreditsInTransaction(tx, input),
    );
  }

  async reserveCreditsInTransaction(
    tx: Tx,
    input: {
      tenantId: string;
      campaignId?: string;
      credits: number;
      idempotencyKey: string;
      expiresAt?: Date;
    },
  ) {
    if (input.credits <= 0)
      throw new BadRequestException('Credits must be positive');
    const existing = await tx.marketingSmsCreditReservation.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const wallet = await this.ensureWallet(input.tenantId, tx);
    const locked = await this.lockWallet(tx, wallet.id);
    if (locked.availableCredits < input.credits) {
      throw new BadRequestException(INSUFFICIENT_CREDITS_MESSAGE);
    }

    const reservation = await tx.marketingSmsCreditReservation.create({
      data: {
        tenantId: input.tenantId,
        walletId: wallet.id,
        campaignId: input.campaignId,
        reservedCredits: input.credits,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
      },
    });
    const updated = await tx.marketingSmsWallet.update({
      where: { id: wallet.id },
      data: {
        availableCredits: { decrement: input.credits },
        reservedCredits: { increment: input.credits },
      },
    });
    await this.createLedger(tx, {
      tenantId: input.tenantId,
      walletId: wallet.id,
      type: 'CAMPAIGN_RESERVATION',
      credits: input.credits,
      before: locked,
      after: updated,
      campaignId: input.campaignId,
      reservationId: reservation.id,
      idempotencyKey: input.idempotencyKey,
    });
    return reservation;
  }

  async consumeReservation(
    tenantId: string,
    reservationId: string,
    credits: number,
  ) {
    if (credits <= 0) throw new BadRequestException('Credits must be positive');
    return this.prisma.$transaction((tx) =>
      this.consumeReservationInTransaction(
        tx,
        tenantId,
        reservationId,
        credits,
      ),
    );
  }

  async consumeReservationInTransaction(
    tx: Tx,
    tenantId: string,
    reservationId: string,
    credits: number,
  ) {
    if (credits <= 0) throw new BadRequestException('Credits must be positive');
    const reservation = await this.lockReservation(tx, tenantId, reservationId);
    const remaining =
      reservation.reservedCredits -
      reservation.consumedCredits -
      reservation.releasedCredits;
    if (remaining < credits)
      throw new BadRequestException('Reservation has insufficient credits');

    const wallet = await this.lockWallet(tx, reservation.walletId);
    const updatedReservation = await tx.marketingSmsCreditReservation.update({
      where: { id: reservation.id },
      data: {
        consumedCredits: { increment: credits },
        status: remaining === credits ? 'CONSUMED' : 'PARTIALLY_CONSUMED',
      },
    });
    const updatedWallet = await tx.marketingSmsWallet.update({
      where: { id: reservation.walletId },
      data: { reservedCredits: { decrement: credits } },
    });
    await this.createLedger(tx, {
      tenantId,
      walletId: reservation.walletId,
      type: 'CAMPAIGN_CONSUMPTION',
      credits,
      before: wallet,
      after: updatedWallet,
      campaignId: reservation.campaignId ?? undefined,
      reservationId: reservation.id,
    });
    return updatedReservation;
  }

  async releaseReservation(
    tenantId: string,
    reservationId: string,
    credits?: number,
  ) {
    return this.prisma.$transaction((tx) =>
      this.releaseReservationInTransaction(
        tx,
        tenantId,
        reservationId,
        credits,
      ),
    );
  }

  async releaseReservationInTransaction(
    tx: Tx,
    tenantId: string,
    reservationId: string,
    credits?: number,
  ) {
    const reservation = await this.lockReservation(tx, tenantId, reservationId);
    const remaining =
      reservation.reservedCredits -
      reservation.consumedCredits -
      reservation.releasedCredits;
    const releaseCredits = credits ?? remaining;
    if (releaseCredits <= 0 || releaseCredits > remaining) {
      throw new BadRequestException('Invalid release credit amount');
    }
    const wallet = await this.lockWallet(tx, reservation.walletId);
    const updatedReservation = await tx.marketingSmsCreditReservation.update({
      where: { id: reservation.id },
      data: {
        releasedCredits: { increment: releaseCredits },
        status:
          releaseCredits === remaining ? 'RELEASED' : 'PARTIALLY_CONSUMED',
      },
    });
    const updatedWallet = await tx.marketingSmsWallet.update({
      where: { id: reservation.walletId },
      data: {
        availableCredits: { increment: releaseCredits },
        reservedCredits: { decrement: releaseCredits },
      },
    });
    await this.createLedger(tx, {
      tenantId,
      walletId: reservation.walletId,
      type: 'CAMPAIGN_RELEASE',
      credits: releaseCredits,
      before: wallet,
      after: updatedWallet,
      campaignId: reservation.campaignId ?? undefined,
      reservationId: reservation.id,
    });
    return updatedReservation;
  }

  async refundCredits(input: {
    tenantId: string;
    credits: number;
    campaignId?: string;
    recipientId?: string;
    reservationId?: string;
    reason?: string;
    idempotencyKey?: string;
  }) {
    if (input.credits <= 0)
      throw new BadRequestException('Credits must be positive');
    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.ensureWallet(input.tenantId, tx);
      if (input.idempotencyKey) {
        const existing = await tx.marketingSmsCreditLedgerEntry.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing)
          return this.toBalance(await this.lockWallet(tx, wallet.id));
      }
      const locked = await this.lockWallet(tx, wallet.id);
      const updated = await tx.marketingSmsWallet.update({
        where: { id: wallet.id },
        data: { availableCredits: { increment: input.credits } },
      });
      await this.createLedger(tx, {
        tenantId: input.tenantId,
        walletId: wallet.id,
        type: 'CAMPAIGN_REFUND',
        credits: input.credits,
        before: locked,
        after: updated,
        campaignId: input.campaignId,
        recipientId: input.recipientId,
        reservationId: input.reservationId,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
      });
      return this.toBalance(updated);
    });
  }

  private async ensureWallet(
    tenantId: string,
    tx: Tx | PrismaService = this.prisma,
  ) {
    return tx.marketingSmsWallet.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  private async lockWallet(tx: Tx, walletId: string): Promise<WalletBalances> {
    const rows = await tx.$queryRaw<WalletBalances[]>(
      Prisma.sql`SELECT "id", "availableCredits", "reservedCredits" FROM "marketing"."MarketingSmsWallet" WHERE "id" = ${walletId} FOR UPDATE`,
    );
    if (!rows[0]) throw new BadRequestException('SMS wallet not found');
    return rows[0];
  }

  private async lockReservation(
    tx: Tx,
    tenantId: string,
    reservationId: string,
  ): Promise<MarketingSmsCreditReservation> {
    const rows = await tx.$queryRaw<MarketingSmsCreditReservation[]>(
      Prisma.sql`SELECT * FROM "marketing"."MarketingSmsCreditReservation" WHERE "id" = ${reservationId} AND "tenantId" = ${tenantId} FOR UPDATE`,
    );
    if (!rows[0])
      throw new BadRequestException('SMS credit reservation not found');
    return rows[0];
  }

  private createLedger(
    tx: Tx,
    input: {
      tenantId: string;
      walletId: string;
      type: MarketingSmsCreditLedgerEntryType;
      credits: number;
      before: WalletBalances;
      after: WalletBalances;
      campaignId?: string;
      recipientId?: string;
      reservationId?: string;
      idempotencyKey?: string;
      reason?: string;
      createdBy?: string;
    },
  ) {
    return tx.marketingSmsCreditLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        walletId: input.walletId,
        type: input.type,
        credits: input.credits,
        availableBefore: input.before.availableCredits,
        availableAfter: input.after.availableCredits,
        reservedBefore: input.before.reservedCredits,
        reservedAfter: input.after.reservedCredits,
        campaignId: input.campaignId,
        recipientId: input.recipientId,
        reservationId: input.reservationId,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
        createdBy: input.createdBy,
      },
    });
  }

  private toBalance(
    wallet: Pick<MarketingSmsWallet, 'availableCredits' | 'reservedCredits'>,
  ) {
    return {
      availableCredits: wallet.availableCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.availableCredits + wallet.reservedCredits,
    };
  }
}
