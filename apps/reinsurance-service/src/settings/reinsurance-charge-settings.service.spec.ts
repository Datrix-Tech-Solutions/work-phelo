import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  ReinsuranceChargeCalculationBasis,
  ReinsuranceChargeCode,
  ReinsuranceChargeDirection,
  ReinsuranceChargeRateType,
  ReinsuranceChargeRoundingMode,
  ReinsuranceChargeType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceChargeSettingsService } from './reinsurance-charge-settings.service';

describe('ReinsuranceChargeSettingsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const user: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant-1',
    tenantSlug: 'demo',
    tenantName: 'Demo',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.taxes-levies:VIEW'],
  };

  const config = {
    id: 'charge-1',
    tenantId: 'tenant-1',
    code: ReinsuranceChargeCode.NIC_LEVY,
    name: 'NIC Levy',
    chargeType: ReinsuranceChargeType.LEVY,
    rateType: ReinsuranceChargeRateType.PERCENTAGE,
    rate: new Prisma.Decimal('1.000000'),
    calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
    direction: ReinsuranceChargeDirection.DEDUCTION,
    currency: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    roundingMode: ReinsuranceChargeRoundingMode.HALF_UP,
    decimalPlaces: 2,
    isEnabled: true,
    displayOrder: 1,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    reinsuranceChargeConfiguration: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
  };
  let service: ReinsuranceChargeSettingsService;

  beforeEach(() => {
    prisma = {
      reinsuranceChargeConfiguration: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new ReinsuranceChargeSettingsService(
      prisma as unknown as PrismaService,
    );
  });

  it('lists tenant-scoped charge configurations with filters', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([config]);
    prisma.reinsuranceChargeConfiguration.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      code: ReinsuranceChargeCode.NIC_LEVY,
      currency: 'GHS',
      isEnabled: true,
      page: 1,
      limit: 10,
    });

    expect(
      prisma.reinsuranceChargeConfiguration.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        code: ReinsuranceChargeCode.NIC_LEVY,
        currency: 'GHS',
        isEnabled: true,
      },
      skip: 0,
      take: 10,
    });
    expect(result.meta.total).toBe(1);
  });

  it('rejects overlapping effective periods for the same code and currency', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(user, {
        code: ReinsuranceChargeCode.NIC_LEVY,
        name: 'NIC Levy',
        chargeType: ReinsuranceChargeType.LEVY,
        rateType: ReinsuranceChargeRateType.PERCENTAGE,
        rate: 1,
        calculationBasis: ReinsuranceChargeCalculationBasis.NET_BEFORE_CHARGES,
        direction: ReinsuranceChargeDirection.DEDUCTION,
        currency: 'GHS',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2026-12-31T23:59:59.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects activation when another configuration overlaps the same code and currency', async () => {
    prisma.reinsuranceChargeConfiguration.findFirst
      .mockResolvedValueOnce(config)
      .mockResolvedValueOnce({ id: 'overlap' });

    await expect(service.activate(user, config.id)).rejects.toThrow(
      ConflictException,
    );

    expect(prisma.reinsuranceChargeConfiguration.update).not.toHaveBeenCalled();
  });

  it('calculates percentage and fixed charges with additions and deductions', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        id: 'nic',
        rate: new Prisma.Decimal('1'),
        direction: ReinsuranceChargeDirection.DEDUCTION,
      },
      {
        ...config,
        id: 'stamp',
        code: ReinsuranceChargeCode.WITHHOLDING_TAX,
        name: 'Document Fee',
        chargeType: ReinsuranceChargeType.FEE,
        rateType: ReinsuranceChargeRateType.FIXED_AMOUNT,
        rate: new Prisma.Decimal('25'),
        direction: ReinsuranceChargeDirection.ADDITION,
        displayOrder: 2,
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 10000,
      commissionAmount: 1000,
      brokerageAmount: 500,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.netBeforeCharges).toBe(8500);
    expect(result.deductions).toBe(85);
    expect(result.additions).toBe(25);
    expect(result.netAmount).toBe(8440);
  });

  it('prefers currency-specific configuration over all-currency configuration', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        id: 'generic',
        rate: new Prisma.Decimal('1'),
        currency: null,
      },
      { ...config, id: 'usd', rate: new Prisma.Decimal('2'), currency: 'USD' },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      commissionAmount: 0,
      brokerageAmount: 0,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.charges).toHaveLength(1);
    expect(result.charges[0]).toMatchObject({
      configurationId: 'usd',
      amount: 20,
    });
  });

  it('uses enabled effective configurations only', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([]);

    await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 1000,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(
      prisma.reinsuranceChargeConfiguration.findMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        isEnabled: true,
        effectiveFrom: { lte: new Date('2026-06-01T00:00:00.000Z') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date('2026-06-01T00:00:00.000Z') } },
        ],
        AND: [{ OR: [{ currency: 'USD' }, { currency: null }] }],
      },
    });
  });

  it('rounds according to configuration mode', async () => {
    prisma.reinsuranceChargeConfiguration.findMany.mockResolvedValue([
      {
        ...config,
        rate: new Prisma.Decimal('1.111'),
        decimalPlaces: 0,
        roundingMode: ReinsuranceChargeRoundingMode.UP,
      },
    ]);

    const result = await service.calculateCharges('tenant-1', {
      currency: 'USD',
      grossAmount: 100,
      effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.charges[0].amount).toBe(2);
    expect(result.netAmount).toBe(98);
  });
});
