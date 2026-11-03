import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockAdjustmentDto, StockAdjustmentType, StockBalanceStatus } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Stock adjustments and status - disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let itemId: string;
  let locationId: string;
  let otherLocation: string;
  let unitId: string;
  const date = '2026-11-03';
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
    unitId = (await service.createUnit(tenant, { name: 'Each' })).id;
    locationId = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
    otherLocation = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
    itemId = (
      await service.createItem(tenant, {
        name: 'Paper',
        sku: 'P',
        categoryId: category.id,
        unitOfMeasureId: unitId,
        reorderLevel: '5',
      })
    ).id;
  });
  const dto = (extra: Partial<StockAdjustmentDto> = {}): StockAdjustmentDto => ({
    itemId,
    locationId,
    type: StockAdjustmentType.INCREASE,
    quantity: '10',
    reason: 'DATA_CORRECTION',
    date,
    ...extra,
  });
  const adjust = (extra: Partial<StockAdjustmentDto> = {}) =>
    service.adjust(tenant, 'user-a', dto(extra));
  const decrease = (quantity: string) => adjust({ type: StockAdjustmentType.DECREASE, quantity });
  const balance = async () =>
    (await service.balances(tenant)).find((r) => r.locationId === locationId)!;

  it('creates/increments balance and records authoritative unit, reason and null costs', async () => {
    const result = await adjust({ reference: 'COUNT-1', notes: 'Recount' });
    expect(result.balance.quantity.toString()).toBe('10');
    expect(result.movement).toMatchObject({
      tenantId: tenant,
      itemId,
      locationId,
      unitOfMeasureId: unitId,
      type: 'ADJUSTMENT_INCREASE',
      adjustmentReason: 'DATA_CORRECTION',
      reference: 'COUNT-1',
      notes: 'Recount',
      createdBy: 'user-a',
      unitCost: null,
      totalCost: null,
    });
    expect(result.movement.date.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    await adjust({ quantity: '0.25' });
    expect((await balance()).quantity.toString()).toBe('10.25');
  });
  it('decrements exactly to zero and records a decrease movement', async () => {
    await adjust();
    const result = await decrease('10');
    expect(result.balance.quantity.toString()).toBe('0');
    expect(result.movement).toMatchObject({
      type: 'ADJUSTMENT_DECREASE',
      unitCost: null,
      totalCost: null,
    });
    expect(
      await service.movements(tenant, ['ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE']),
    ).toHaveLength(2);
    expect(await service.movements(tenant, ['STOCK_IN'])).toEqual([]);
  });
  it('rejects missing or insufficient balance without writes', async () => {
    await expect(decrease('1')).rejects.toBeInstanceOf(ConflictException);
    expect(await service.balances(tenant)).toEqual([]);
    expect(await service.movements(tenant)).toEqual([]);
    await adjust();
    await expect(decrease('11')).rejects.toBeInstanceOf(ConflictException);
    expect((await balance()).quantity.toString()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it.each([StockAdjustmentType.INCREASE, StockAdjustmentType.DECREASE])(
    'isolates tenants and rejects inactive items for %s',
    async (type) => {
      await expect(service.adjust('other', 'user', dto({ type }))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const foreign = await service.createLocation('other-' + tenant, {
        name: 'Other',
        type: 'STORE',
      });
      for (const id of [foreign.id, randomUUID()])
        await expect(adjust({ type, locationId: id })).rejects.toBeInstanceOf(NotFoundException);
      await service.updateItem(tenant, itemId, { status: 'INACTIVE' });
      await expect(adjust({ type })).rejects.toBeInstanceOf(ConflictException);
      expect(await service.movements(tenant)).toEqual([]);
    },
  );
  it('rejects nonpositive quantities', () => {
    for (const quantity of ['0', '-1'])
      expect(() => adjust({ quantity })).toThrow(BadRequestException);
  });
  it.each([StockAdjustmentType.INCREASE, StockAdjustmentType.DECREASE])(
    'rolls movement back if balance write fails for %s',
    async (type) => {
      await adjust();
      const failing = prisma.$extends({
        query: {
          stockBalance: {
            update() {
              throw new Error('balance failed');
            },
            upsert() {
              throw new Error('balance failed');
            },
          },
        },
      });
      await expect(
        new InventoryService(failing as unknown as PrismaService).adjust(
          tenant,
          'user',
          dto({ type, quantity: '1' }),
        ),
      ).rejects.toThrow('balance failed');
      expect((await balance()).quantity.toString()).toBe('10');
      expect(await service.movements(tenant)).toHaveLength(1);
    },
  );
  it('serializes two decreases of 8 against 10', async () => {
    await adjust();
    const results = await Promise.allSettled([decrease('8'), decrease('8')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason instanceof ConflictException).toBe(
      true,
    );
    expect((await balance()).quantity.toString()).toBe('2');
    expect(await service.movements(tenant, ['ADJUSTMENT_DECREASE'])).toHaveLength(1);
  });
  it('returns identity fields and dynamically reports thresholds and zero stock', async () => {
    await adjust();
    expect(await balance()).toMatchObject({
      itemId,
      locationId,
      item: { id: itemId, name: 'Paper', sku: 'P' },
      location: { id: locationId, name: 'Main', type: 'WAREHOUSE' },
      unitOfMeasure: { id: unitId, name: 'Each' },
      isLowStock: false,
      isOutOfStock: false,
    });
    expect((await balance()).reorderLevel!.toString()).toBe('5');
    await decrease('5');
    expect((await balance()).isLowStock).toBe(true);
    await decrease('1');
    expect((await balance()).isLowStock).toBe(true);
    expect(await service.balances(tenant, StockBalanceStatus.LOW_STOCK)).toHaveLength(1);
    await decrease('4');
    expect(await balance()).toMatchObject({ isLowStock: true, isOutOfStock: true });
    expect(await service.balances(tenant, StockBalanceStatus.OUT_OF_STOCK)).toHaveLength(1);
    await service.updateItem(tenant, itemId, { reorderLevel: null });
    expect(await balance()).toMatchObject({
      isLowStock: false,
      isOutOfStock: true,
      reorderLevel: null,
    });
    expect(await service.balances(tenant, StockBalanceStatus.LOW_STOCK)).toEqual([]);
    expect(await service.balances('other', StockBalanceStatus.OUT_OF_STOCK)).toEqual([]);
  });
  it('reflects receipts, issues, transfers and adjustments without generating missing balances', async () => {
    expect(await service.balances(tenant, StockBalanceStatus.OUT_OF_STOCK)).toEqual([]);
    await service.stockIn(tenant, 'user', {
      itemId,
      locationId,
      quantity: '6',
      dateReceived: date,
    });
    expect((await balance()).isLowStock).toBe(false);
    await service.stockOut(tenant, 'user', {
      itemId,
      locationId,
      quantity: '1',
      date,
      purpose: 'SALE',
    });
    expect((await balance()).isLowStock).toBe(true);
    await service.transfer(tenant, 'user', {
      itemId,
      sourceLocationId: locationId,
      destinationLocationId: otherLocation,
      quantity: '5',
      date,
    });
    expect(
      (await service.balances(tenant, StockBalanceStatus.OUT_OF_STOCK)).map((r) => r.locationId),
    ).toEqual([locationId]);
    await adjust({ quantity: '6' });
    expect(await balance()).toMatchObject({ isLowStock: false, isOutOfStock: false });
    expect(await service.balances(tenant)).toHaveLength(2);
  });
});
