import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';

// Opt-in, disposable localhost database only. Never falls back to DATABASE_URL.
const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Inventory PostgreSQL integrity and transactions', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let categoryId: string;
  let unitOfMeasureId: string;
  let locationId: string;
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
    categoryId = (await service.createCategory(tenant, { name: 'Office' })).id;
    unitOfMeasureId = (await service.createUnit(tenant, { name: 'Each' })).id;
    locationId = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
  });
  const item = (sku = 'P-1') =>
    service.createItem(tenant, { name: 'Paper', sku, categoryId, unitOfMeasureId });
  const receive = (itemId: string, quantity = '1', unitCost?: string) =>
    service.stockIn(tenant, 'user-a', {
      itemId,
      locationId,
      quantity,
      unitCost,
      dateReceived: '2026-11-02',
    });

  it('enforces category/unit/location unique names in a tenant, permits other tenants and supports update/delete', async () => {
    await expect(service.createCategory(tenant, { name: 'Office' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.createUnit(tenant, { name: 'Each' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.createLocation(tenant, { name: 'Main', type: 'STORE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.createCategory('other-' + tenant, { name: 'Office' });
    await service.createUnit('other-' + tenant, { name: 'Each' });
    await service.createLocation('other-' + tenant, { name: 'Main', type: 'BRANCH' });
    expect((await service.updateCategory(tenant, categoryId, { name: 'New' })).name).toBe('New');
    expect((await service.updateUnit(tenant, unitOfMeasureId, { name: 'Pack' })).name).toBe('Pack');
    expect((await service.updateLocation(tenant, locationId, { type: 'OTHER' })).type).toBe(
      'OTHER',
    );
    expect(await service.listCategory(tenant)).toHaveLength(1);
    expect(await service.listUnit(tenant)).toHaveLength(1);
    expect(await service.listLocation(tenant)).toHaveLength(1);
    await service.deleteCategory(tenant, categoryId);
    await service.deleteUnit(tenant, unitOfMeasureId);
    await service.deleteLocation(tenant, locationId);
    await expect(service.getCategory(tenant, categoryId)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects cross-tenant reads/updates/deletes for every lookup', async () => {
    for (const id of [categoryId, randomUUID()]) {
      await expect(service.getCategory('other', id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateCategory('other', id, { name: 'Stolen' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.deleteCategory('other', id)).rejects.toBeInstanceOf(NotFoundException);
    }
    await expect(service.getUnit('other', unitOfMeasureId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateUnit('other', unitOfMeasureId, { name: 'Stolen' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteUnit('other', unitOfMeasureId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getLocation('other', locationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateLocation('other', locationId, { name: 'Stolen' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteLocation('other', locationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('enforces concurrent item SKU uniqueness and update collisions, while allowing a different tenant', async () => {
    const created = await item();
    expect(created.status).toBe('ACTIVE');
    const results = await Promise.allSettled([item('P-2'), item('P-2')]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    await expect(service.updateItem(tenant, created.id, { sku: 'P-2' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const other = 'other-' + tenant;
    const category = await service.createCategory(other, { name: 'Office' });
    const unit = await service.createUnit(other, { name: 'Each' });
    await service.createItem(other, {
      name: 'Paper',
      sku: 'P-1',
      categoryId: category.id,
      unitOfMeasureId: unit.id,
    });
    expect(await service.listItems(tenant)).toHaveLength(2);
  });
  it('rejects cross-tenant/missing category and unit, including item updates and raw FK writes', async () => {
    await expect(
      service.createItem('other', { name: 'Paper', sku: 'P', categoryId, unitOfMeasureId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.createItem(tenant, {
        name: 'Paper',
        sku: 'P',
        categoryId,
        unitOfMeasureId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const created = await item();
    await expect(service.getItem('other', created.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateItem('other', created.id, { name: 'Stolen' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateItem(tenant, created.id, { categoryId: randomUUID() }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      prisma.inventoryItem.create({
        data: { tenantId: 'other', name: 'Bad', sku: 'Bad', categoryId, unitOfMeasureId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('blocks category/unit deletion when an item exists', async () => {
    await item();
    await expect(service.deleteCategory(tenant, categoryId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.deleteUnit(tenant, unitOfMeasureId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('records a receipt with exact value, creates/increments balances and preserves its unit/creator', async () => {
    const created = await item();
    const first = await receive(created.id, '1.25', '0.1');
    expect(first.movement.totalCost!.toString()).toBe('0.125');
    expect(first.movement.unitOfMeasureId).toBe(unitOfMeasureId);
    expect(first.movement.createdBy).toBe('user-a');
    const second = await receive(created.id, '2');
    expect(second.movement.totalCost).toBeNull();
    expect(second.balance.quantity.toString()).toBe('3.25');
    expect(await service.movements(tenant)).toHaveLength(2);
    expect(await service.movements('other')).toEqual([]);
    expect(await service.balances('other')).toEqual([]);
    await expect(service.deleteLocation(tenant, locationId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('preserves full precision for large receipt products', async () => {
    const created = await item();
    const result = await receive(created.id, '12345678901234.5678', '12345678901234.5678');
    expect(result.movement.totalCost!.toFixed(8)).toBe('152415787532388365279682997.65279684');
  });
  it('does not lose concurrent increments on the first balance', async () => {
    const created = await item();
    await Promise.all([
      receive(created.id, '1.1'),
      receive(created.id, '2.2'),
      receive(created.id, '3.3'),
    ]);
    const rows = await service.balances(tenant);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity.toString()).toBe('6.6');
    expect(await service.movements(tenant)).toHaveLength(3);
  });
  it('rejects non-positive quantity, inactive items, wrong-tenant item/location without movements', async () => {
    const created = await item();
    expect(() => receive(created.id, '0')).toThrow(BadRequestException);
    await service.updateItem(tenant, created.id, { status: 'INACTIVE' });
    await expect(receive(created.id)).rejects.toBeInstanceOf(ConflictException);
    await service.updateItem(tenant, created.id, { status: 'ACTIVE' });
    await expect(
      service.stockIn('other', 'user', {
        itemId: created.id,
        locationId,
        quantity: '1',
        dateReceived: '2026-11-02',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.stockIn(tenant, 'user', {
        itemId: created.id,
        locationId: randomUUID(),
        quantity: '1',
        dateReceived: '2026-11-02',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.movements(tenant)).toEqual([]);
  });
  it('derives low-stock state per location only when configured and prevents reinterpreting balances in another unit', async () => {
    const created = await item();
    await receive(created.id, '1');
    expect((await service.balances(tenant))[0].isLowStock).toBe(false);
    await service.updateItem(tenant, created.id, { reorderLevel: '1' });
    expect((await service.balances(tenant))[0].isLowStock).toBe(true);
    const other = await service.createLocation(tenant, { name: 'Other', type: 'STORE' });
    await service.stockIn(tenant, 'user', {
      itemId: created.id,
      locationId: other.id,
      quantity: '2',
      dateReceived: '2026-11-02',
    });
    expect((await service.balances(tenant)).map((x) => x.isLowStock).sort()).toEqual([false, true]);
    const unit = await service.createUnit(tenant, { name: 'Pack' });
    await expect(
      service.updateItem(tenant, created.id, { unitOfMeasureId: unit.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rolls back the movement when balance write fails', async () => {
    const created = await item();
    const failing = prisma.$extends({
      query: {
        stockBalance: {
          upsert() {
            throw new Error('test balance failure');
          },
        },
      },
    });
    const scoped = new InventoryService(failing as unknown as PrismaService);
    await expect(
      scoped.stockIn(tenant, 'user', {
        itemId: created.id,
        locationId,
        quantity: '1',
        dateReceived: '2026-11-02',
      }),
    ).rejects.toThrow('test balance failure');
    expect(await service.movements(tenant)).toEqual([]);
    expect(await service.balances(tenant)).toEqual([]);
  });
  it('does not change an existing balance when movement creation fails', async () => {
    const created = await item();
    await receive(created.id, '2');
    const failing = prisma.$extends({
      query: {
        stockMovement: {
          create() {
            throw new Error('test movement failure');
          },
        },
      },
    });
    const scoped = new InventoryService(failing as unknown as PrismaService);
    await expect(
      scoped.stockIn(tenant, 'user', {
        itemId: created.id,
        locationId,
        quantity: '1',
        dateReceived: '2026-11-02',
      }),
    ).rejects.toThrow('test movement failure');
    expect((await service.balances(tenant))[0].quantity.toString()).toBe('2');
    expect(await service.movements(tenant)).toHaveLength(1);
  });
});
