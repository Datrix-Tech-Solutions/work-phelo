import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  NormalBalance,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

describe('AccountingMasterDataService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  function setup() {
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      accountingCurrency: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        count: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      gLAccount: {
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const service = new AccountingMasterDataService(
      prisma as unknown as PrismaService,
    );
    return { prisma, service };
  }

  it('rejects locking an open fiscal period', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.changeFiscalPeriodStatus(
        actor,
        'period-1',
        FiscalPeriodStatus.LOCKED,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.fiscalPeriod.updateMany).not.toHaveBeenCalled();
  });

  it('locks only a closed tenant period with an atomic scoped mutation', async () => {
    const { prisma, service } = setup();
    const closedPeriod = {
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.CLOSED,
    };
    prisma.fiscalPeriod.findFirst.mockResolvedValue(closedPeriod);
    prisma.fiscalPeriod.updateMany.mockResolvedValue({ count: 1 });
    prisma.fiscalPeriod.findUniqueOrThrow.mockResolvedValue({
      ...closedPeriod,
      status: FiscalPeriodStatus.LOCKED,
    });

    await service.changeFiscalPeriodStatus(
      actor,
      closedPeriod.id,
      FiscalPeriodStatus.LOCKED,
    );

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: closedPeriod.id,
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.CLOSED,
        },
      }),
    );
  });

  it('blocks base currency changes after journals exist', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'USD',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
    });
    prisma.journalEntry.count.mockResolvedValue(1);

    await expect(
      service.updateConfig(actor, { baseCurrency: 'USD' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.accountingTenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('does not allow a summary account to be re-enabled for posting', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1000',
      name: 'Assets',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      parentAccountId: null,
      allowPosting: false,
      status: RecordStatus.ACTIVE,
    });
    prisma.gLAccount.count.mockResolvedValue(1);

    await expect(
      service.updateGLAccount(actor, 'account-1', { allowPosting: true }),
    ).rejects.toThrow('Summary accounts with child accounts');
    expect(prisma.gLAccount.update).not.toHaveBeenCalled();
  });

  it('uses the tenant composite key for currency mutations', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findFirst.mockResolvedValue({
      id: 'currency-1',
      tenantId: actor.tenantId,
      code: 'USD',
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);
    prisma.accountingCurrency.update.mockResolvedValue({
      id: 'currency-1',
      code: 'USD',
    });

    await service.updateCurrency(actor, 'currency-1', {
      name: 'US Dollar',
    });

    expect(prisma.accountingCurrency.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: {
            id: 'currency-1',
            tenantId: actor.tenantId,
          },
        },
      }),
    );
  });
});
