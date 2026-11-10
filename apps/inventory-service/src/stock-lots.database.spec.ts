import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockAdjustmentType } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Perishable items and lot details - disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let location: string;
  let milk: string; // perishable
  let paper: string; // non-perishable
  const dateReceived = '2026-11-09';
  beforeAll(async () => {
    const url = new URL(process.env.INVENTORY_TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/inventory_test')
      throw new Error('Only disposable localhost inventory_test is allowed');
    prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
    await prisma.$connect();
    service = new InventoryService(prisma);
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  beforeEach(async () => {
    tenant = randomUUID();
    const category = await service.createCategory(tenant, { name: 'Goods' });
    const unit = await service.createUnit(tenant, { name: 'Each' });
    location = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
    const item = (name: string, sku: string, isPerishable?: boolean) =>
      service
        .createItem(tenant, {
          name,
          sku,
          categoryId: category.id,
          unitOfMeasureId: unit.id,
          isPerishable,
        })
        .then((i) => i.id);
    milk = await item('Milk', 'M', true);
    paper = await item('Paper', 'P');
  });
  const receive = (itemId: string, extra: object = {}) =>
    service.stockIn(tenant, 'user-a', {
      itemId,
      locationId: location,
      quantity: '5',
      dateReceived,
      ...extra,
    });

  it('defaults items to non-perishable and stores the flag', async () => {
    expect((await service.getItem(tenant, paper)).isPerishable).toBe(false);
    expect((await service.getItem(tenant, milk)).isPerishable).toBe(true);
    const updated = await service.updateItem(tenant, paper, { isPerishable: true });
    expect(updated.isPerishable).toBe(true);
  });

  it('stores the lot number and dates on a perishable stock in', async () => {
    await receive(milk, {
      lotNumber: 'LOT-1',
      manufactureDate: '2026-10-01',
      expiryDate: '2026-12-01',
    });
    const [m] = await service.movements(tenant);
    expect(m.lotNumber).toBe('LOT-1');
    expect(m.manufactureDate?.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(m.expiryDate?.toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('requires an expiry date for a perishable item, but not a lot number or manufacturing date', async () => {
    await expect(receive(milk, { lotNumber: 'LOT-1' })).rejects.toBeInstanceOf(BadRequestException);
    await receive(milk, { expiryDate: '2026-12-01' });
    const [m] = await service.movements(tenant);
    expect(m.lotNumber).toBeNull();
    expect(m.manufactureDate).toBeNull();
  });

  it('rejects an expiry date before the manufacturing date', async () => {
    await expect(
      receive(milk, { manufactureDate: '2026-11-01', expiryDate: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('takes only an optional lot number for a non-perishable item', async () => {
    await receive(paper, { lotNumber: 'LOT-9' });
    await receive(paper);
    await expect(receive(paper, { expiryDate: '2026-12-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(receive(paper, { manufactureDate: '2026-10-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await service.movements(tenant)).map((m) => m.lotNumber).sort()).toEqual([
      'LOT-9',
      null,
    ]);
  });

  it('saves lot details per line in a stock in batch, and nothing if one line is invalid', async () => {
    const header = { locationId: location, dateReceived, reference: 'GRN-1' };
    await service.stockInBatch(tenant, 'user-a', {
      ...header,
      lines: [
        { itemId: milk, quantity: '2', lotNumber: 'A', expiryDate: '2026-12-01' },
        { itemId: paper, quantity: '3', lotNumber: 'B' },
      ],
    });
    const rows = await service.movements(tenant);
    expect(rows.find((m) => m.itemId === milk)?.expiryDate).not.toBeNull();
    expect(rows.find((m) => m.itemId === paper)?.lotNumber).toBe('B');

    await expect(
      service.stockInBatch(tenant, 'user-a', {
        ...header,
        lines: [
          { itemId: paper, quantity: '1' },
          { itemId: milk, quantity: '1' }, // perishable, no expiry
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.movements(tenant)).toHaveLength(2);
  });

  describe('stock out from batches', () => {
    const issue = (itemId: string, quantity: string, extra: object = {}) =>
      service.stockOut(tenant, 'user-a', {
        itemId,
        locationId: location,
        quantity,
        date: dateReceived,
        purpose: 'SALE',
        ...extra,
      });
    const lots = (itemId: string) => service.lots(tenant, itemId);
    const remaining = async (itemId: string) => {
      const out: Record<string, string> = {};
      for (const l of await lots(itemId)) out[l.lotNumber ?? ''] = l.remainingQuantity.toString();
      return out;
    };

    beforeEach(async () => {
      await receive(milk, { lotNumber: 'LATE', expiryDate: '2027-02-01' });
      await receive(milk, { lotNumber: 'SOON', expiryDate: '2026-12-01' });
    });

    it('creates a lot per batch with everything remaining', async () => {
      expect(await remaining(milk)).toEqual({ LATE: '5', SOON: '5' });
    });

    it('draws on a chosen batch and records it on the movement', async () => {
      const late = (await lots(milk)).find((l) => l.lotNumber === 'LATE')!;
      await issue(milk, '2', { lotId: late.id });
      expect(await remaining(milk)).toEqual({ LATE: '3', SOON: '5' });
      const out = (await service.movements(tenant)).find((m) => m.type === 'STOCK_OUT')!;
      expect(out.lotId).toBe(late.id);
    });

    it('rejects more than a batch holds, and a batch from another location or variant', async () => {
      const soon = (await lots(milk)).find((l) => l.lotNumber === 'SOON')!;
      await expect(issue(milk, '6', { lotId: soon.id })).rejects.toBeInstanceOf(ConflictException);
      await expect(issue(milk, '1', { lotId: randomUUID() })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(await remaining(milk)).toEqual({ LATE: '5', SOON: '5' });
    });

    it('takes the earliest expiry first when no batch is chosen, spilling into the next', async () => {
      await issue(milk, '7');
      expect(await remaining(milk)).toEqual({ LATE: '3', SOON: '0' });
      const outs = (await service.movements(tenant)).filter((m) => m.type === 'STOCK_OUT');
      expect(outs.map((m) => m.quantity.toString()).sort()).toEqual(['2', '5']);
      expect(
        (await service.balances(tenant)).find((b) => b.itemId === milk)?.quantity.toString(),
      ).toBe('3');
    });

    it('leaves items without batches working as before', async () => {
      await receive(paper, { quantity: '5' });
      await issue(paper, '2');
      const out = (await service.movements(tenant)).find(
        (m) => m.type === 'STOCK_OUT' && m.itemId === paper,
      )!;
      expect(out.lotId).toBeNull();
    });

    it('saves nothing when one stock-out line is short', async () => {
      const late = (await lots(milk)).find((l) => l.lotNumber === 'LATE')!;
      await expect(
        service.stockOutBatch(tenant, 'user-a', {
          locationId: location,
          date: dateReceived,
          purpose: 'SALE',
          lines: [
            { itemId: milk, quantity: '1', lotId: late.id },
            { itemId: milk, quantity: '50' },
          ],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await remaining(milk)).toEqual({ LATE: '5', SOON: '5' });
    });
  });

  describe('transfers, adjustments and returns', () => {
    let branch: string;
    const lots = (itemId: string, locationId?: string) =>
      service
        .lots(tenant, itemId)
        .then((rows) => rows.filter((l) => !locationId || l.locationId === locationId));
    const left = async (itemId: string, locationId: string) => {
      const out: Record<string, string> = {};
      for (const l of await lots(itemId, locationId))
        out[l.lotNumber ?? ''] = l.remainingQuantity.toString();
      return out;
    };
    const transfer = (itemId: string, quantity: string, extra: object = {}) =>
      service.transfer(tenant, 'user-a', {
        itemId,
        quantity,
        sourceLocationId: location,
        destinationLocationId: branch,
        date: dateReceived,
        ...extra,
      });
    const adjust = (itemId: string, type: StockAdjustmentType, quantity: string, extra = {}) =>
      service.adjust(tenant, 'user-a', {
        itemId,
        quantity,
        locationId: location,
        type,
        reason: 'DAMAGE',
        date: dateReceived,
        ...extra,
      });

    beforeEach(async () => {
      branch = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
      await receive(milk, { lotNumber: 'LATE', expiryDate: '2027-02-01' });
      await receive(milk, { lotNumber: 'SOON', expiryDate: '2026-12-01' });
    });

    it('moves a chosen batch to the destination with its number and dates', async () => {
      const soon = (await lots(milk, location)).find((l) => l.lotNumber === 'SOON')!;
      await transfer(milk, '2', { lotId: soon.id });
      expect(await left(milk, location)).toEqual({ LATE: '5', SOON: '3' });
      const atBranch = await lots(milk, branch);
      expect(atBranch).toHaveLength(1);
      expect(atBranch[0].lotNumber).toBe('SOON');
      expect(atBranch[0].expiryDate?.toISOString().slice(0, 10)).toBe('2026-12-01');
      expect(atBranch[0].remainingQuantity.toString()).toBe('2');
    });

    it('adds to the matching batch at the destination instead of duplicating it', async () => {
      await transfer(milk, '2');
      await transfer(milk, '1');
      const atBranch = await lots(milk, branch);
      expect(atBranch).toHaveLength(1);
      expect(atBranch[0].remainingQuantity.toString()).toBe('3');
      expect(atBranch[0].receivedQuantity.toString()).toBe('3');
    });

    it('takes the earliest expiry first on a transfer and splits across batches', async () => {
      await transfer(milk, '7');
      expect(await left(milk, location)).toEqual({ LATE: '3', SOON: '0' });
      expect(await left(milk, branch)).toEqual({ LATE: '2', SOON: '5' });
    });

    it('rejects a transfer of more than a batch holds, changing nothing', async () => {
      const soon = (await lots(milk, location)).find((l) => l.lotNumber === 'SOON')!;
      await expect(transfer(milk, '6', { lotId: soon.id })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(await lots(milk, branch)).toHaveLength(0);
    });

    it('draws a decrease from a chosen batch, or earliest expiry first', async () => {
      const late = (await lots(milk, location)).find((l) => l.lotNumber === 'LATE')!;
      await adjust(milk, StockAdjustmentType.DECREASE, '2', { lotId: late.id });
      expect(await left(milk, location)).toEqual({ LATE: '3', SOON: '5' });
      await adjust(milk, StockAdjustmentType.DECREASE, '6');
      expect(await left(milk, location)).toEqual({ LATE: '2', SOON: '0' });
    });

    it('adds an increase to a chosen batch, or leaves it unbatched', async () => {
      const soon = (await lots(milk, location)).find((l) => l.lotNumber === 'SOON')!;
      await adjust(milk, StockAdjustmentType.INCREASE, '3', { lotId: soon.id });
      expect(await left(milk, location)).toEqual({ LATE: '5', SOON: '8' });
      await adjust(milk, StockAdjustmentType.INCREASE, '4');
      expect(await left(milk, location)).toEqual({ LATE: '5', SOON: '8' });
      expect(
        (await service.balances(tenant))
          .find((b) => b.itemId === milk && b.locationId === location)
          ?.quantity.toString(),
      ).toBe('17');
    });

    it('returns stock to its batch by receiving into it, and rejects a mismatched batch', async () => {
      const soon = (await lots(milk, location)).find((l) => l.lotNumber === 'SOON')!;
      await service.stockOut(tenant, 'user-a', {
        itemId: milk,
        locationId: location,
        quantity: '4',
        date: dateReceived,
        purpose: 'SALE',
        lotId: soon.id,
      });
      await receive(milk, { lotId: soon.id, quantity: '4' });
      expect(await left(milk, location)).toEqual({ LATE: '5', SOON: '5' });
      await expect(receive(milk, { lotId: soon.id, lotNumber: 'OTHER' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(receive(milk, { lotId: randomUUID() })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.stockIn(tenant, 'user-a', {
          itemId: paper,
          locationId: location,
          quantity: '1',
          dateReceived,
          lotId: soon.id,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('movement values', () => {
    it('values stock out at the selling price and transfers/adjustments at the cost price', async () => {
      await service.updateItem(tenant, paper, { costPrice: '2', sellingPrice: '5' });
      const branch = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
      await receive(paper, { quantity: '10' });
      await service.stockOut(tenant, 'user-a', {
        itemId: paper,
        locationId: location,
        quantity: '3',
        date: dateReceived,
        purpose: 'SALE',
      });
      await service.transfer(tenant, 'user-a', {
        itemId: paper,
        quantity: '2',
        sourceLocationId: location,
        destinationLocationId: branch,
        date: dateReceived,
      });
      await service.adjust(tenant, 'user-a', {
        itemId: paper,
        quantity: '1',
        locationId: location,
        type: StockAdjustmentType.DECREASE,
        reason: 'DAMAGE',
        date: dateReceived,
      });
      const rows = await service.movements(tenant);
      const value = (type: string) =>
        rows
          .filter((m) => m.type === type)
          .map((m) => [m.unitCost?.toString(), m.totalCost?.toString()]);
      expect(value('STOCK_OUT')).toEqual([['5', '15']]);
      expect(value('TRANSFER_OUT')).toEqual([['2', '4']]);
      expect(value('TRANSFER_IN')).toEqual([['2', '4']]);
      expect(value('ADJUSTMENT_DECREASE')).toEqual([['2', '2']]);
    });

    it('values a variant assignment at the cost price', async () => {
      await service.updateItem(tenant, paper, { costPrice: '2' });
      await receive(paper, { quantity: '6' });
      await service.assignVariant(tenant, 'user-a', {
        itemId: paper,
        locationId: location,
        variant: 'Red',
        quantity: '4',
      });
      const rows = (await service.movements(tenant)).filter(
        (m) => m.adjustmentReason === 'VARIANT_ASSIGNMENT',
      );
      expect(rows).toHaveLength(2);
      expect(rows.map((m) => m.totalCost?.toString())).toEqual(['8', '8']);
    });

    it('leaves the value empty when the item has no price', async () => {
      await receive(paper, { quantity: '4' });
      await service.stockOut(tenant, 'user-a', {
        itemId: paper,
        locationId: location,
        quantity: '1',
        date: dateReceived,
        purpose: 'SALE',
      });
      const out = (await service.movements(tenant)).find((m) => m.type === 'STOCK_OUT')!;
      expect(out.unitCost).toBeNull();
      expect(out.totalCost).toBeNull();
    });
  });
});
