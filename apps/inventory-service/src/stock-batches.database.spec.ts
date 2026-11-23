import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockAdjustmentType } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Stock batches - disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let paper: string;
  let pens: string;
  let main: string;
  let branch: string;
  const date = '2026-11-04';
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
    const category = await service.createCategory(tenant, { name: 'Office' });
    const unit = await service.createUnit(tenant, { name: 'Each' });
    main = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
    branch = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
    const item = (name: string, sku: string) =>
      service
        .createItem(tenant, {
          name,
          sku,
          categoryId: category.id,
          unitOfMeasureId: unit.id,
        })
        .then((i) => i.id);
    paper = await item('Paper', 'P');
    pens = await item('Pens', 'N');
  });
  const received = (lines: { itemId: string; quantity: string }[]) =>
    service.stockInBatch(tenant, 'user-a', {
      locationId: main,
      dateReceived: date,
      supplier: 'Acme',
      reference: 'GRN-1',
      lines,
    });
  const quantityAt = async (itemId: string, locationId: string) =>
    (await service.balances(tenant))
      .find((r) => r.itemId === itemId && r.locationId === locationId)
      ?.quantity.toString();

  it('saves every line under one shared batchId, with the header on each row', async () => {
    const result = await received([
      { itemId: paper, quantity: '10' },
      { itemId: pens, quantity: '4' },
    ]);
    const movements = await service.movements(tenant);
    expect(movements).toHaveLength(2);
    expect(new Set(movements.map((m) => m.batchId))).toEqual(new Set([result.batchId]));
    expect(movements.every((m) => m.reference === 'GRN-1' && m.supplier === 'Acme')).toBe(true);
    expect(await quantityAt(paper, main)).toBe('10');
    expect(await quantityAt(pens, main)).toBe('4');
  });

  it('leaves movements saved one at a time without a batchId', async () => {
    await service.stockIn(tenant, 'user-a', {
      itemId: paper,
      locationId: main,
      quantity: '1',
      dateReceived: date,
    });
    expect((await service.movements(tenant))[0].batchId).toBeNull();
  });

  it('gives separate batches separate ids', async () => {
    const first = await received([{ itemId: paper, quantity: '1' }]);
    const second = await received([{ itemId: paper, quantity: '1' }]);
    expect(first.batchId).not.toBe(second.batchId);
  });

  it('saves nothing when one stock-out line has insufficient stock', async () => {
    await received([
      { itemId: paper, quantity: '10' },
      { itemId: pens, quantity: '2' },
    ]);
    await expect(
      service.stockOutBatch(tenant, 'user-a', {
        locationId: main,
        date,
        purpose: 'SALE',
        lines: [
          { itemId: paper, quantity: '5' },
          { itemId: pens, quantity: '3' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await quantityAt(paper, main)).toBe('10');
    expect(await quantityAt(pens, main)).toBe('2');
    expect(await service.movements(tenant, ['STOCK_OUT'])).toEqual([]);
  });

  it('checks repeated lines for the same item against the running balance', async () => {
    await received([{ itemId: paper, quantity: '10' }]);
    await expect(
      service.stockOutBatch(tenant, 'user-a', {
        locationId: main,
        date,
        purpose: 'SALE',
        lines: [
          { itemId: paper, quantity: '6' },
          { itemId: paper, quantity: '6' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await quantityAt(paper, main)).toBe('10');
  });

  it('transfers every line together, one shared batchId and a transferId per item', async () => {
    await received([
      { itemId: paper, quantity: '10' },
      { itemId: pens, quantity: '4' },
    ]);
    const result = await service.transferBatch(tenant, 'user-a', {
      sourceLocationId: main,
      destinationLocationId: branch,
      date,
      lines: [
        { itemId: paper, quantity: '5' },
        { itemId: pens, quantity: '4' },
      ],
    });
    expect(await quantityAt(paper, main)).toBe('5');
    expect(await quantityAt(paper, branch)).toBe('5');
    expect(await quantityAt(pens, main)).toBe('0');
    const moved = await service.movements(tenant, ['TRANSFER_OUT', 'TRANSFER_IN']);
    expect(moved).toHaveLength(4);
    expect(moved.every((m) => m.batchId === result.batchId)).toBe(true);
    expect(new Set(moved.map((m) => m.transferId)).size).toBe(2);
  });

  it('saves no part of a transfer batch when one line is short', async () => {
    await received([
      { itemId: paper, quantity: '10' },
      { itemId: pens, quantity: '1' },
    ]);
    await expect(
      service.transferBatch(tenant, 'user-a', {
        sourceLocationId: main,
        destinationLocationId: branch,
        date,
        lines: [
          { itemId: paper, quantity: '5' },
          { itemId: pens, quantity: '2' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await quantityAt(paper, main)).toBe('10');
    expect(await quantityAt(paper, branch)).toBeUndefined();
    expect(await service.movements(tenant, ['TRANSFER_OUT', 'TRANSFER_IN'])).toEqual([]);
  });

  it('applies an adjustment batch together and rolls back on a short decrease', async () => {
    await received([
      { itemId: paper, quantity: '10' },
      { itemId: pens, quantity: '1' },
    ]);
    const ok = await service.adjustBatch(tenant, 'user-a', {
      locationId: main,
      type: StockAdjustmentType.DECREASE,
      reason: 'DAMAGE',
      date,
      lines: [
        { itemId: paper, quantity: '2' },
        { itemId: pens, quantity: '1' },
      ],
    });
    expect(await quantityAt(paper, main)).toBe('8');
    expect(await quantityAt(pens, main)).toBe('0');
    const adjusted = await service.movements(tenant, ['ADJUSTMENT_DECREASE']);
    expect(adjusted.every((m) => m.batchId === ok.batchId)).toBe(true);

    await expect(
      service.adjustBatch(tenant, 'user-a', {
        locationId: main,
        type: StockAdjustmentType.DECREASE,
        reason: 'LOSS',
        date,
        lines: [
          { itemId: paper, quantity: '1' },
          { itemId: pens, quantity: '1' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await quantityAt(paper, main)).toBe('8');
  });
});
