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
      lines: [{ itemId: 'item-1', variant: 'Fixed Top', quantity: '33', unitCost: '40' }],
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
