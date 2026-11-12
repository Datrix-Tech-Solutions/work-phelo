import { Prisma } from '../prisma/generated/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from './prisma/prisma.service';

// No database: a stand-in client records what the service sends to Prisma. A nested order line
// must not carry tenantId (Prisma fills it from the order and rejects it otherwise).
describe('InventoryService.createPurchaseOrder - payload', () => {
  it('creates the lines without a tenantId of their own', async () => {
    const create = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({ id: 'po-1', lines: [] });
    const tx = {
      inventoryParty: {
        findFirst: jest.fn().mockResolvedValue({ kind: 'SUPPLIER', status: 'ACTIVE' }),
      },
      stockLocation: { findFirst: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([{ status: 'ACTIVE' }]) },
      purchaseOrder: { create },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    const service = new InventoryService(prisma as unknown as PrismaService);

    await service.createPurchaseOrder('tenant-1', 'user-1', {
      orderDate: '2026-11-11',
      supplierId: 'supplier-1',
      locationId: 'location-1',
      lines: [{ itemId: 'item-1', variant: 'Fixed Top', quantity: '33' }],
    });

    const args = create.mock.calls[0][0] as {
      data: { tenantId: string; lines: { create: Record<string, unknown>[] } };
    };
    expect(args.data.tenantId).toBe('tenant-1');
    expect(args.data.lines.create).toHaveLength(1);
    expect(args.data.lines.create[0]).not.toHaveProperty('tenantId');
    expect(args.data.lines.create[0]).toMatchObject({ itemId: 'item-1', variantName: 'Fixed Top' });
  });
});

describe('InventoryService.closePurchaseOrder', () => {
  const setup = (status: string) => {
    const update = jest.fn().mockResolvedValue({ id: 'po-1', status: 'CLOSED', lines: [] });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      purchaseOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'po-1', status, lines: [] }),
        update,
      },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    return {
      service: new InventoryService(prisma as unknown as PrismaService),
      update,
    };
  };

  it('closes a partly received order', async () => {
    const { service, update } = setup('PARTIALLY_RECEIVED');
    await service.closePurchaseOrder('t1', 'po-1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CLOSED' } }));
  });

  it.each([
    ['ORDERED', /cancel it instead/],
    ['RECEIVED', /in full/],
    ['CANCELLED', /cancelled/],
    ['CLOSED', /already closed/],
  ])('refuses a %s order', async (status, message) => {
    const { service, update } = setup(status);
    await expect(service.closePurchaseOrder('t1', 'po-1')).rejects.toThrow(message);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('InventoryService.createSupplierPayment', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'po-1',
    reference: 'PO-1',
    supplierId: 's1',
    status: 'PARTIALLY_RECEIVED',
    paymentTerms: 'Due on receipt',
    // 100 invoiced; 10 received at 5 = 50 received.
    lines: [{ invoicedValue: new Prisma.Decimal(100), receivedValue: new Prisma.Decimal(50) }],
    payments: [{ amount: new Prisma.Decimal(20) }],
    ...over,
  });
  const setup = (orders: Record<string, unknown>[], supplier: unknown = { kind: 'SUPPLIER' }) => {
    const create = jest.fn().mockResolvedValue({ id: 'pay-1' });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      inventoryParty: { findFirst: jest.fn().mockResolvedValue(supplier) },
      purchaseOrder: { findMany: jest.fn().mockResolvedValue(orders) },
      supplierPayment: { create },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    return { service: new InventoryService(prisma as unknown as PrismaService), create };
  };
  const dto = (allocations: { purchaseOrderId: string; amount: string }[]) => ({
    supplierId: 's1',
    paymentDate: '2026-11-15',
    method: 'CASH' as const,
    allocations,
  });

  it('records one payment across several orders, totalled, without a tenantId on the shares', async () => {
    const { service, create } = setup([
      order(),
      order({ id: 'po-2', reference: 'PO-2', payments: [] }),
    ]);
    await service.createSupplierPayment(
      't1',
      'u1',
      dto([
        { purchaseOrderId: 'po-1', amount: '30' },
        { purchaseOrderId: 'po-2', amount: '50' },
      ]),
    );
    const [args] = create.mock.calls[0] as [
      {
        data: {
          tenantId: string;
          amount: { toString(): string };
          allocations: { create: object[] };
        };
      },
    ];
    expect(args.data.tenantId).toBe('t1');
    expect(args.data.amount.toString()).toBe('80');
    expect(args.data.allocations.create).toHaveLength(2);
    expect(args.data.allocations.create[0]).not.toHaveProperty('tenantId');
  });

  it('refuses to pay more than is owed so far', async () => {
    const { service, create } = setup([order()]);
    await expect(
      service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '30.01' }]),
      ),
    ).rejects.toThrow(/more than the 30.00 owed/);
    expect(create).not.toHaveBeenCalled();
  });

  it('pays against the invoice unless the terms are pay-on-receipt', async () => {
    const { service, create } = setup([order({ paymentTerms: 'Net 30' })]);
    // 100 invoiced less 20 already paid: 80 can be paid before the goods arrive.
    await expect(
      service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '80.01' }]),
      ),
    ).rejects.toThrow(/more than the 80.00 owed/);
    await service.createSupplierPayment(
      't1',
      'u1',
      dto([{ purchaseOrderId: 'po-1', amount: '80' }]),
    );
    expect(create).toHaveBeenCalled();
  });

  it('pays only what was received once the order is closed', async () => {
    const { service } = setup([order({ paymentTerms: 'Net 30', status: 'CLOSED' })]);
    await expect(
      service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '30.01' }]),
      ),
    ).rejects.toThrow(/more than the 30.00 owed/);
  });

  it('refuses a cancelled order and another supplier’s order', async () => {
    const cancelled = setup([order({ status: 'CANCELLED' })]);
    await expect(
      cancelled.service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '1' }]),
      ),
    ).rejects.toThrow(/cancelled/);
    const other = setup([order({ supplierId: 's2' })]);
    await expect(
      other.service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '1' }]),
      ),
    ).rejects.toThrow(/not an order from this supplier/);
  });

  it('refuses a repeated order', () => {
    const { service, create } = setup([order()]);
    expect(() =>
      service.createSupplierPayment(
        't1',
        'u1',
        dto([
          { purchaseOrderId: 'po-1', amount: '1' },
          { purchaseOrderId: 'po-1', amount: '1' },
        ]),
      ),
    ).toThrow(/only appear once/);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an unknown supplier', async () => {
    const none = setup([order()], null);
    await expect(
      none.service.createSupplierPayment(
        't1',
        'u1',
        dto([{ purchaseOrderId: 'po-1', amount: '1' }]),
      ),
    ).rejects.toThrow(/Supplier not found/);
  });
});
