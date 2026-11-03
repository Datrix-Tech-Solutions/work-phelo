import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockOutDto, StockTransferDto } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Stock issues/transfers - PostgreSQL atomicity and concurrency', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let itemId: string;
  let unitId: string;
  let source: string;
  let destination: string;
  const date = '2026-11-02';
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
    source = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
    destination = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
    itemId = (
      await service.createItem(tenant, {
        name: 'Paper',
        sku: 'P',
        categoryId: category.id,
        unitOfMeasureId: unitId,
      })
    ).id;
    await service.stockIn(tenant, 'user-a', {
      itemId,
      locationId: source,
      quantity: '10',
      unitCost: '2',
      dateReceived: date,
    });
  });
  const issue = (extra: Partial<StockOutDto> = {}) =>
    service.stockOut(tenant, 'user-a', {
      itemId,
      locationId: source,
      quantity: '8',
      date,
      purpose: 'INTERNAL_USE',
      ...extra,
    });
  const transfer = (extra: Partial<StockTransferDto> = {}) =>
    service.transfer(tenant, 'user-a', {
      itemId,
      sourceLocationId: source,
      destinationLocationId: destination,
      quantity: '8',
      date,
      ...extra,
    });
  const sourceQuantity = async () =>
    (await service.balances(tenant)).find((x) => x.locationId === source)!.quantity.toString();

  it('decrements stock, records purpose/recipient and configured UOM without valuation', async () => {
    const result = await issue({
      recipient: 'Team A',
      reference: 'ISSUE-1',
      notes: 'Internal use',
    });
    expect(result.balance.quantity.toString()).toBe('2');
    expect(result.movement).toMatchObject({
      tenantId: tenant,
      itemId,
      locationId: source,
      type: 'STOCK_OUT',
      purpose: 'INTERNAL_USE',
      recipient: 'Team A',
      reference: 'ISSUE-1',
      unitOfMeasureId: unitId,
      createdBy: 'user-a',
      unitCost: null,
      totalCost: null,
      transferId: null,
    });
    expect(result.movement.quantity.toString()).toBe('8');
    expect(result.movement.date.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    const receipt = (await service.movements(tenant)).find((x) => x.type === 'STOCK_IN')!;
    expect(receipt.totalCost!.toString()).toBe('20');
  });
  it('returns conflict for insufficient stock without any movement or balance change', async () => {
    await expect(issue({ quantity: '11' })).rejects.toBeInstanceOf(ConflictException);
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('returns conflict for a missing source balance', async () => {
    await expect(issue({ locationId: destination })).rejects.toBeInstanceOf(ConflictException);
    expect(await service.balances(tenant)).toHaveLength(1);
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('allows exactly the available amount but rejects the next issue at zero', async () => {
    await issue({ quantity: '10' });
    await expect(issue({ quantity: '0.0001' })).rejects.toBeInstanceOf(ConflictException);
    expect(await sourceQuantity()).toBe('0');
    expect(await service.movements(tenant)).toHaveLength(2);
  });
  it('rejects inactive items for both operations', async () => {
    await service.updateItem(tenant, itemId, { status: 'INACTIVE' });
    await expect(issue()).rejects.toBeInstanceOf(ConflictException);
    await expect(transfer()).rejects.toBeInstanceOf(ConflictException);
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('rejects zero/negative quantities before writes', () => {
    for (const quantity of ['0', '-1']) {
      expect(() => issue({ quantity })).toThrow(BadRequestException);
      expect(() => transfer({ quantity })).toThrow(BadRequestException);
    }
  });
  it('denies cross-tenant items for both operations', async () => {
    await expect(
      service.stockOut('other', 'user', {
        itemId,
        locationId: source,
        quantity: '1',
        date,
        purpose: 'SALE',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.transfer('other', 'user', {
        itemId,
        sourceLocationId: source,
        destinationLocationId: destination,
        quantity: '1',
        date,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements('other')).toEqual([]);
  });
  it('denies cross-tenant/missing issue locations', async () => {
    const foreign = await service.createLocation('other-' + tenant, {
      name: 'Foreign',
      type: 'STORE',
    });
    for (const locationId of [foreign.id, randomUUID()])
      await expect(issue({ locationId })).rejects.toBeInstanceOf(NotFoundException);
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('rolls back a created issue movement if the decrement fails', async () => {
    const failing = prisma.$extends({
      query: {
        stockBalance: {
          update() {
            throw new Error('decrement failed');
          },
        },
      },
    });
    await expect(
      new InventoryService(failing as unknown as PrismaService).stockOut(tenant, 'user', {
        itemId,
        locationId: source,
        quantity: '1',
        date,
        purpose: 'SALE',
      }),
    ).rejects.toThrow('decrement failed');
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('does not decrement when issue movement creation fails', async () => {
    const failing = prisma.$extends({
      query: {
        stockMovement: {
          create() {
            throw new Error('movement failed');
          },
        },
      },
    });
    await expect(
      new InventoryService(failing as unknown as PrismaService).stockOut(tenant, 'user', {
        itemId,
        locationId: source,
        quantity: '1',
        date,
        purpose: 'SALE',
      }),
    ).rejects.toThrow('movement failed');
    expect(await sourceQuantity()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('permits only one of two simultaneous issues of 8 against a balance of 10', async () => {
    const results = await Promise.allSettled([issue(), issue()]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((x) => x.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason instanceof ConflictException).toBe(
      true,
    );
    expect(await sourceQuantity()).toBe('2');
    expect(await service.movements(tenant, ['STOCK_OUT'])).toHaveLength(1);
  });
  it('transfers to a new destination balance with two linked, unvalued movements', async () => {
    const result = await transfer({ quantity: '3.25', reference: 'MOVE-1', notes: 'Branch stock' });
    expect(result.sourceBalance.quantity.toString()).toBe('6.75');
    expect(result.destinationBalance.quantity.toString()).toBe('3.25');
    expect(result.movements.map((x) => x.type)).toEqual(['TRANSFER_OUT', 'TRANSFER_IN']);
    expect(result.movements.map((x) => x.locationId)).toEqual([source, destination]);
    expect(result.transferId).toMatch(/^[0-9a-f-]{36}$/);
    for (const movement of result.movements) {
      expect(movement).toMatchObject({
        transferId: result.transferId,
        tenantId: tenant,
        itemId,
        unitOfMeasureId: unitId,
        unitCost: null,
        totalCost: null,
        createdBy: 'user-a',
        reference: 'MOVE-1',
      });
      expect(movement.quantity.toString()).toBe('3.25');
    }
    expect(
      (await service.balances(tenant)).reduce((total, row) => total + Number(row.quantity), 0),
    ).toBe(10);
  });
  it('increments an existing destination without changing company-wide quantity', async () => {
    await service.stockIn(tenant, 'user', {
      itemId,
      locationId: destination,
      quantity: '2',
      dateReceived: date,
    });
    const result = await transfer({ quantity: '2' });
    expect(result.sourceBalance.quantity.toString()).toBe('8');
    expect(result.destinationBalance.quantity.toString()).toBe('4');
    expect(
      (await service.balances(tenant)).reduce((total, row) => total + Number(row.quantity), 0),
    ).toBe(12);
  });
  it('rejects insufficient/missing source stock without creating destination/history', async () => {
    await expect(transfer({ quantity: '11' })).rejects.toBeInstanceOf(ConflictException);
    const empty = await service.createLocation(tenant, { name: 'Empty', type: 'STORE' });
    await expect(transfer({ sourceLocationId: empty.id })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await sourceQuantity()).toBe('10');
    expect(await service.balances(tenant)).toHaveLength(1);
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('rejects a transfer to the same location before writes', () => {
    expect(() => transfer({ destinationLocationId: source })).toThrow(BadRequestException);
  });
  it.each(['sourceLocationId', 'destinationLocationId'] as const)(
    'denies a foreign/missing transfer %s',
    async (field) => {
      const foreign = await service.createLocation('other-' + tenant, {
        name: 'Foreign',
        type: 'OFFICE_STORE',
      });
      for (const id of [foreign.id, randomUUID()])
        await expect(transfer({ [field]: id })).rejects.toBeInstanceOf(NotFoundException);
      expect(await sourceQuantity()).toBe('10');
      expect(await service.balances(tenant)).toHaveLength(1);
      expect(await service.movements(tenant)).toHaveLength(1);
    },
  );
  it('rolls back source decrement if destination upsert fails', async () => {
    const failing = prisma.$extends({
      query: {
        stockBalance: {
          upsert() {
            throw new Error('destination failed');
          },
        },
      },
    });
    await expect(
      new InventoryService(failing as unknown as PrismaService).transfer(tenant, 'user', {
        itemId,
        sourceLocationId: source,
        destinationLocationId: destination,
        quantity: '1',
        date,
      }),
    ).rejects.toThrow('destination failed');
    expect(await sourceQuantity()).toBe('10');
    expect(await service.balances(tenant)).toHaveLength(1);
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('rolls back both balances and the first history row if the second history row fails', async () => {
    const failing = prisma.$extends({
      query: {
        stockMovement: {
          create({ args, query }) {
            if (args.data.type === 'TRANSFER_IN') throw new Error('second movement failed');
            return query(args);
          },
        },
      },
    });
    await expect(
      new InventoryService(failing as unknown as PrismaService).transfer(tenant, 'user', {
        itemId,
        sourceLocationId: source,
        destinationLocationId: destination,
        quantity: '1',
        date,
      }),
    ).rejects.toThrow('second movement failed');
    expect(await sourceQuantity()).toBe('10');
    expect(await service.balances(tenant)).toHaveLength(1);
    expect(await service.movements(tenant)).toHaveLength(1);
  });
  it('serializes transfers competing for the same source stock', async () => {
    const results = await Promise.allSettled([transfer(), transfer()]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await sourceQuantity()).toBe('2');
    expect(
      (await service.balances(tenant))
        .find((x) => x.locationId === destination)!
        .quantity.toString(),
    ).toBe('8');
    expect(await service.movements(tenant, ['TRANSFER_IN', 'TRANSFER_OUT'])).toHaveLength(2);
  });
  it('serializes a competing issue and transfer without overspending or partial transfer', async () => {
    const results = await Promise.allSettled([issue(), transfer()]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await sourceQuantity()).toBe('2');
    const issues = await service.movements(tenant, ['STOCK_OUT']);
    const transfers = await service.movements(tenant, ['TRANSFER_OUT', 'TRANSFER_IN']);
    expect(issues.length === 1 ? transfers.length === 0 : transfers.length === 2).toBe(true);
  });
  it('keeps shared history tenant-scoped, type-filtered and deterministically ordered', async () => {
    await issue({ quantity: '1' });
    await transfer({ quantity: '1' });
    const history = await service.movements(tenant);
    expect(new Set(history.map((x) => x.type))).toEqual(
      new Set(['STOCK_IN', 'STOCK_OUT', 'TRANSFER_OUT', 'TRANSFER_IN']),
    );
    expect((await service.movements(tenant, ['STOCK_OUT'])).map((x) => x.type)).toEqual([
      'STOCK_OUT',
    ]);
    expect(await service.movements('other', ['TRANSFER_IN', 'TRANSFER_OUT'])).toEqual([]);
    expect(await service.movements(tenant, [])).toEqual([]);
    expect((await service.movements(tenant)).map((x) => x.id)).toEqual(history.map((x) => x.id));
  });
});
