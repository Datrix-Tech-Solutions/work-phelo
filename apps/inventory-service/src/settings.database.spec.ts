import { randomUUID } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockAdjustmentType } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Inventory settings contract - disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
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
  beforeEach(() => {
    tenant = randomUUID();
  });
  const setup = async () => {
    const category = await service.createCategory(tenant, { name: 'Office' });
    const unit = await service.createUnit(tenant, { name: 'Each', symbol: 'ea' });
    const location = await service.createLocation(tenant, { name: 'Main', code: 'MAIN' });
    const item = await service.createItem(tenant, {
      name: 'Paper',
      sku: 'P',
      categoryId: category.id,
      unitOfMeasureId: unit.id,
    });
    return { category, unit, location, item };
  };
  it('persists category configuration, derives itemCount and isolates tenants', async () => {
    const category = await service.createCategory(tenant, {
      name: 'Office',
      description: 'Supplies',
      icon: 'box',
      status: 'ACTIVE',
    });
    const unit = await service.createUnit(tenant, { name: 'Each' });
    await service.createItem(tenant, {
      name: 'Paper',
      sku: 'P',
      categoryId: category.id,
      unitOfMeasureId: unit.id,
    });
    expect(await service.getCategory(tenant, category.id)).toMatchObject({
      description: 'Supplies',
      icon: 'box',
      status: 'ACTIVE',
      itemCount: 1,
    });
    expect((await service.listCategory(tenant))[0].itemCount).toBe(1);
    await service.updateCategory(tenant, category.id, {
      description: null,
      icon: null,
      status: 'INACTIVE',
    });
    expect(await service.getCategory(tenant, category.id)).toMatchObject({
      description: null,
      icon: null,
      status: 'INACTIVE',
      itemCount: 1,
    });
    expect(await service.listCategory('other')).toEqual([]);
    await expect(service.getCategory('other', category.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deleteCategory(tenant, category.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('persists unit configuration; symbols are not globally or tenant unique', async () => {
    const unit = await service.createUnit(tenant, {
      name: 'Each',
      symbol: 'ea',
      description: 'Individual',
      status: 'INACTIVE',
    });
    expect(await service.getUnit(tenant, unit.id)).toMatchObject({
      symbol: 'ea',
      description: 'Individual',
      status: 'INACTIVE',
    });
    await service.createUnit(tenant, { name: 'Piece', symbol: 'ea' });
    await service.updateUnit(tenant, unit.id, {
      symbol: 'pcs',
      description: null,
      status: 'ACTIVE',
    });
    expect((await service.listUnit(tenant)).find((u) => u.id === unit.id)).toMatchObject({
      symbol: 'pcs',
      description: null,
      status: 'ACTIVE',
    });
  });
  it('retains legacy name-only creation and never overwrites omitted fields on PATCH', async () => {
    const category = await service.createCategory(tenant, { name: 'Office' });
    expect(category).toMatchObject({ description: null, icon: null, status: 'ACTIVE' });
    const unit = await service.createUnit(tenant, { name: 'Each' });
    expect(unit.symbol).toBe(unit.id.slice(0, 10));
    const location = await service.createLocation(tenant, { name: 'Store', type: 'STORE' });
    expect(location.code).toBe('LOC-' + location.id.toUpperCase());
    expect(location.status).toBe('ACTIVE');
    expect((await service.updateLocation(tenant, location.id, { name: 'Renamed' })).type).toBe(
      'STORE',
    );
    expect((await service.updateUnit(tenant, unit.id, { name: 'Renamed' })).symbol).toBe(
      unit.symbol,
    );
  });
  it('defaults warehouse type, normalizes code and enforces tenant-scoped code uniqueness on create/update', async () => {
    const warehouse = await service.createLocation(tenant, {
      name: 'Main',
      code: ' main ',
      address: 'Accra',
    });
    expect(await service.getLocation(tenant, warehouse.id)).toMatchObject({
      code: 'MAIN',
      address: 'Accra',
      status: 'ACTIVE',
      type: 'WAREHOUSE',
      itemCount: 0,
    });
    const other = await service.createLocation(tenant, {
      name: 'Other',
      code: 'OTHER',
      type: 'BRANCH',
    });
    await expect(
      service.createLocation(tenant, { name: 'Duplicate', code: 'main' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.updateLocation(tenant, other.id, { code: ' main ' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const concurrent = await Promise.allSettled([
      service.createLocation(tenant, { name: 'A', code: 'SAME' }),
      service.createLocation(tenant, { name: 'B', code: 'SAME' }),
    ]);
    expect(concurrent.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await service.createLocation('other-' + tenant, { name: 'Main', code: 'MAIN' });
    await service.updateLocation(tenant, warehouse.id, {
      code: ' new ',
      address: null,
      status: 'INACTIVE',
    });
    expect(await service.getLocation(tenant, warehouse.id)).toMatchObject({
      code: 'NEW',
      address: null,
      status: 'INACTIVE',
    });
  });
  it('counts distinct items with balance rows, including zero, but never fakes stockValue', async () => {
    const { item, location } = await setup();
    const receipt = {
      itemId: item.id,
      locationId: location.id,
      quantity: '1',
      dateReceived: '2026-11-03',
    };
    await service.stockIn(tenant, 'user', receipt);
    await service.stockIn(tenant, 'user', receipt);
    await service.stockOut(tenant, 'user', {
      itemId: item.id,
      locationId: location.id,
      quantity: '2',
      date: '2026-11-03',
      purpose: 'SALE',
    });
    const otherItem = await service.createItem(tenant, {
      name: 'Pens',
      sku: 'P2',
      categoryId: item.categoryId,
      unitOfMeasureId: item.unitOfMeasureId,
    });
    await service.stockIn(tenant, 'user', { ...receipt, itemId: otherItem.id });
    const row = await service.getLocation(tenant, location.id);
    expect(row.itemCount).toBe(2);
    expect(row).not.toHaveProperty('stockValue');
    expect((await service.listLocation(tenant))[0].itemCount).toBe(2);
  });
  it.each(['category', 'unit'] as const)(
    'rejects new assignment to inactive %s without breaking existing items',
    async (kind) => {
      const { category, unit, item } = await setup();
      const inactive =
        kind === 'category'
          ? await service.createCategory(tenant, { name: 'Inactive', status: 'INACTIVE' })
          : await service.createUnit(tenant, { name: 'Inactive', symbol: 'X', status: 'INACTIVE' });
      const refs = {
        categoryId: category.id,
        unitOfMeasureId: unit.id,
        [kind === 'category' ? 'categoryId' : 'unitOfMeasureId']: inactive.id,
      };
      await expect(
        service.createItem(tenant, { name: 'New', sku: 'NEW', ...refs }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(service.updateItem(tenant, item.id, refs)).rejects.toBeInstanceOf(
        ConflictException,
      );
      if (kind === 'category')
        await service.updateCategory(tenant, category.id, { status: 'INACTIVE' });
      else await service.updateUnit(tenant, unit.id, { status: 'INACTIVE' });
      const location = await service.createLocation(tenant, {
        name: 'Historical',
        code: 'HISTORY',
      });
      await service.stockIn(tenant, 'user', {
        itemId: item.id,
        locationId: location.id,
        quantity: '1',
        dateReceived: '2026-11-03',
      });
      expect(await service.movements(tenant)).toHaveLength(1);
      expect((await service.getItem(tenant, item.id)).id).toBe(item.id);
      expect(
        (
          await service.updateItem(tenant, item.id, {
            name: 'Renamed',
            categoryId: category.id,
            unitOfMeasureId: unit.id,
          })
        ).name,
      ).toBe('Renamed');
    },
  );
  it('rejects all new stock activity at inactive locations, preserving history/balances', async () => {
    const { item, location } = await setup();
    const destination = await service.createLocation(tenant, { name: 'Destination', code: 'DEST' });
    const receipt = {
      itemId: item.id,
      locationId: location.id,
      quantity: '10',
      dateReceived: '2026-11-03',
    };
    await service.stockIn(tenant, 'user', receipt);
    await service.updateLocation(tenant, location.id, { status: 'INACTIVE' });
    const movement = {
      itemId: item.id,
      locationId: location.id,
      quantity: '1',
      date: '2026-11-03',
    };
    await expect(service.stockIn(tenant, 'user', receipt)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.stockOut(tenant, 'user', { ...movement, purpose: 'SALE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.adjust(tenant, 'user', {
        ...movement,
        type: StockAdjustmentType.INCREASE,
        reason: 'DATA_CORRECTION',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.adjust(tenant, 'user', {
        ...movement,
        type: StockAdjustmentType.DECREASE,
        reason: 'DAMAGE',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    for (const [source, target] of [
      [location.id, destination.id],
      [destination.id, location.id],
    ])
      await expect(
        service.transfer(tenant, 'user', {
          itemId: item.id,
          sourceLocationId: source,
          destinationLocationId: target,
          quantity: '1',
          date: '2026-11-03',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.getLocation(tenant, location.id)).status).toBe('INACTIVE');
    expect((await service.balances(tenant))[0].quantity.toString()).toBe('10');
    expect(await service.movements(tenant)).toHaveLength(1);
    await expect(service.deleteLocation(tenant, location.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
