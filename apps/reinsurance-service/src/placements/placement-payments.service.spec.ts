import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementPaymentsService } from './placement-payments.service';

describe('PlacementPaymentsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };
  const lastCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls.at(-1);
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    cedantId: 'cedant-1',
    currency: 'USD',
  };

  const payment = {
    id: 'payment-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    closingId: null,
    participantId: null,
    counterpartyId: 'cedant-1',
    type: PlacementPaymentType.PREMIUM_RECEIVED,
    direction: PlacementPaymentDirection.INBOUND,
    amount: new Prisma.Decimal('1000.00'),
    currency: 'USD',
    paymentDate: new Date('2026-06-04T12:00:00.000Z'),
    reference: 'BANK-001',
    notes: null,
    status: PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T12:00:00.000Z'),
    updatedAt: new Date('2026-06-04T12:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: null,
    },
    participant: null,
    closing: null,
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    counterparty: { findFirst: PrismaMethod };
    placementClosing: { findFirst: PrismaMethod };
    placementPayment: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementPaymentsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      counterparty: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementPayment: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementPaymentsService(prisma as unknown as PrismaService);
  });

  it('lists payments for an active tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findMany.mockResolvedValue([payment]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placementPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException when listing payments for another tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a cedant premium received payment', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });
    prisma.placementPayment.create.mockResolvedValue(payment);

    const result = await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'usd',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        amount: 1000,
        currency: 'USD',
        status: PlacementPaymentStatus.RECORDED,
      }),
    );
    expect(result.id).toBe('payment-1');
  });

  it('rejects payment before any confirmed closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a payment currency mismatch', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'GHS',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects premium received from a non-cedant counterparty', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'other-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'other-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates reinsurer disbursement only with matching confirmed closing and participant', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementClosing.findFirst
      .mockResolvedValueOnce({ id: 'closing-1' })
      .mockResolvedValueOnce({
        id: 'closing-1',
        participant: {
          id: 'participant-1',
          counterpartyId: 'reinsurer-1',
        },
      });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-2',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      closingId: 'closing-1',
      participantId: 'participant-1',
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    const closingLookup = lastCallArg<Prisma.PlacementClosingFindFirstArgs>(
      prisma.placementClosing.findFirst,
    );
    expect(closingLookup.where).toMatchObject({
      id: 'closing-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      participantId: 'participant-1',
      status: PlacementClosingStatus.CONFIRMED,
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
    });
  });

  it('rejects wrong-tenant or mismatched closing/participant for reinsurer disbursement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementClosing.findFirst
      .mockResolvedValueOnce({ id: 'closing-1' })
      .mockResolvedValueOnce(null);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        closingId: 'closing-1',
        participantId: 'participant-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects claim settlement payments through the generic payment creation API', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.CLAIM_SETTLEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('creates an auditable reversal record and marks the original reversed', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(payment);
    prisma.placementPayment.update.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
    });

    const result = await service.reverse(user, 'placement-1', 'payment-1');

    expect(prisma.placementPayment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PlacementPaymentStatus.REVERSED },
    });
    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
      status: PlacementPaymentStatus.RECORDED,
    });
    expect(result.reversalOfPaymentId).toBe('payment-1');
  });

  it('rejects reversing an already reversed payment', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'payment-1'),
    ).rejects.toThrow(ConflictException);
  });
});
