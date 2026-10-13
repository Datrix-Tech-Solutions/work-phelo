import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { SmsWalletService } from './sms-wallet.service';

const TENANT = 'tenant-1';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;
const platformUser = {
  id: 'platform-1',
  tenantId: TENANT,
  role: 'SUPER_ADMIN',
} as RequestUser;
const like = (fields: Record<string, unknown>): unknown =>
  expect.objectContaining(fields);

const wallet = (availableCredits = 100, reservedCredits = 0) => ({
  id: 'wallet-1',
  tenantId: TENANT,
  availableCredits,
  reservedCredits,
  createdAt: new Date('2026-10-05T00:00:00.000Z'),
  updatedAt: new Date('2026-10-05T00:00:00.000Z'),
});

describe('SmsWalletService', () => {
  const tx = {
    marketingSmsWallet: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    marketingSmsCreditLedgerEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    marketingSmsCreditReservation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const prisma = {
    marketingSmsWallet: {
      upsert: jest.fn(),
    },
    marketingSmsCreditLedgerEntry: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new SmsWalletService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.marketingSmsWallet.upsert.mockResolvedValue(wallet());
    tx.marketingSmsWallet.upsert.mockResolvedValue(wallet());
    tx.$queryRaw.mockResolvedValue([wallet()]);
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  it('lazily creates a wallet when reading balance', async () => {
    await expect(service.getBalance(TENANT)).resolves.toEqual({
      availableCredits: 100,
      reservedCredits: 0,
      totalCredits: 100,
    });
    expect(prisma.marketingSmsWallet.upsert).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      update: {},
      create: { tenantId: TENANT },
    });
  });

  it('grants credits and writes an immutable ledger entry', async () => {
    tx.marketingSmsWallet.update.mockResolvedValue(wallet(150));

    const result = await service.grantCredits(platformUser, {
      credits: 50,
      reason: 'local test',
      idempotencyKey: 'grant-1',
    });

    expect(tx.marketingSmsWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { availableCredits: { increment: 50 } },
    });
    expect(tx.marketingSmsCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: like({
        type: 'ADMIN_GRANT',
        credits: 50,
        availableBefore: 100,
        availableAfter: 150,
        idempotencyKey: 'grant-1',
      }),
    });
    expect(result.availableCredits).toBe(150);
  });

  it('does not double-grant credits for the same idempotency key', async () => {
    tx.marketingSmsCreditLedgerEntry.findUnique.mockResolvedValue({
      id: 'ledger-1',
    });

    await service.grantCredits(platformUser, {
      credits: 50,
      idempotencyKey: 'grant-1',
    });

    expect(tx.marketingSmsWallet.update).not.toHaveBeenCalled();
    expect(tx.marketingSmsCreditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('blocks tenant users from granting credits', async () => {
    await expect(
      service.grantCredits(user, {
        credits: 50,
        idempotencyKey: 'grant-1',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reserves credits atomically when balance is sufficient', async () => {
    tx.marketingSmsCreditReservation.create.mockResolvedValue({
      id: 'reservation-1',
      tenantId: TENANT,
      walletId: 'wallet-1',
      reservedCredits: 25,
      consumedCredits: 0,
      releasedCredits: 0,
      status: 'ACTIVE',
    });
    tx.marketingSmsWallet.update.mockResolvedValue(wallet(75, 25));

    const result = await service.reserveCredits({
      tenantId: TENANT,
      campaignId: 'campaign-1',
      credits: 25,
      idempotencyKey: 'reserve-1',
    });

    expect(tx.marketingSmsWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        availableCredits: { decrement: 25 },
        reservedCredits: { increment: 25 },
      },
    });
    expect(result.id).toBe('reservation-1');
  });

  it('rejects reservations when available credits are insufficient', async () => {
    tx.$queryRaw.mockResolvedValue([wallet(10, 0)]);

    await expect(
      service.reserveCredits({
        tenantId: TENANT,
        credits: 25,
        idempotencyKey: 'reserve-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
