import { InventoryService } from './inventory.service';
import { PrismaService } from './prisma/prisma.service';

// No database: a stand-in client holds the company's existing records and records what is created.
function setup(existing: {
  categories?: Record<string, unknown>[];
  subcategories?: Record<string, unknown>[];
  units?: Record<string, unknown>[];
  skus?: string[];
}) {
  let seq = 0;
  const created = {
    categories: [] as string[],
    subcategories: [] as string[],
    units: [] as string[],
  };
  const tx = {
    inventoryCategory: {
      create: jest.fn(({ data }: { data: { name: string } }) => {
        created.categories.push(data.name);
        return Promise.resolve({ id: `cat-new-${++seq}`, status: 'ACTIVE', ...data });
      }),
    },
    inventorySubcategory: {
      create: jest.fn(({ data }: { data: { name: string } }) => {
        created.subcategories.push(data.name);
        return Promise.resolve({ id: `sub-new-${++seq}`, status: 'ACTIVE', ...data });
      }),
    },
    unitOfMeasure: {
      create: jest.fn(({ data }: { data: { name: string } }) => {
        created.units.push(data.name);
        return Promise.resolve({ status: 'ACTIVE', ...data });
      }),
    },
    itemVariant: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    inventoryItem: {
      create: jest.fn(({ data }: { data: { sku: string } }) =>
        data.sku === 'BAD'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve({ id: `item-${++seq}`, ...data }),
      ),
    },
  };
  const prisma = {
    inventoryCategory: { findMany: jest.fn().mockResolvedValue(existing.categories ?? []) },
    inventorySubcategory: { findMany: jest.fn().mockResolvedValue(existing.subcategories ?? []) },
    unitOfMeasure: { findMany: jest.fn().mockResolvedValue(existing.units ?? []) },
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue((existing.skus ?? []).map((sku) => ({ sku }))),
    },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  return { service: new InventoryService(prisma as unknown as PrismaService), tx, created };
}

const row = (over: Record<string, unknown> = {}) => ({
  name: 'A4 Paper',
  sku: 'PAPER-1',
  category: 'Stationery',
  unit: 'Box',
  ...over,
});

describe('InventoryService.bulkImportItems', () => {
  it('creates a missing category, subcategory and unit, once for rows that share them', async () => {
    const { service, created } = setup({});
    const out = await service.bulkImportItems('t1', {
      rows: [
        row({ subcategory: 'Paper' }),
        row({ sku: 'PAPER-2', subcategory: 'paper', category: 'STATIONERY', unit: 'box' }),
      ],
    });
    expect(out.results.map((r) => r.status)).toEqual(['created', 'created']);
    expect(created).toEqual({
      categories: ['Stationery'],
      subcategories: ['Paper'],
      units: ['Box'],
    });
    expect(out.createdCategories).toEqual(['Stationery']);
    expect(out.createdUnits).toEqual(['Box']);
  });

  it('uses existing categories and units, ignoring case', async () => {
    const { service, created, tx } = setup({
      categories: [{ id: 'cat-1', name: 'Stationery', status: 'ACTIVE' }],
      units: [{ id: 'unit-1', name: 'Box', status: 'ACTIVE' }],
    });
    await service.bulkImportItems('t1', { rows: [row({ category: 'stationery', unit: 'BOX' })] });
    expect(created).toEqual({ categories: [], subcategories: [], units: [] });
    expect(tx.inventoryItem.create.mock.calls[0][0].data).toMatchObject({
      categoryId: 'cat-1',
      unitOfMeasureId: 'unit-1',
    });
  });

  it('skips an existing SKU and fails an inactive category without creating anything', async () => {
    const { service, created } = setup({
      categories: [{ id: 'cat-1', name: 'Old', status: 'INACTIVE' }],
      skus: ['paper-1'],
    });
    const out = await service.bulkImportItems('t1', {
      rows: [row(), row({ sku: 'X', category: 'Old' })],
    });
    expect(out.results[0]).toMatchObject({ status: 'skipped', message: 'Already exists' });
    expect(out.results[1]).toMatchObject({
      status: 'failed',
      message: 'Category "Old" is inactive',
    });
    expect(created.units).toEqual([]);
  });

  it('does not report a category as created when its item failed', async () => {
    const { service } = setup({});
    const out = await service.bulkImportItems('t1', { rows: [row({ sku: 'BAD' })] });
    expect(out.results[0]).toMatchObject({ status: 'failed', message: 'boom' });
    expect(out.createdCategories).toEqual([]);
  });

  it('rejects a maximum stock below the reorder level', async () => {
    const { service } = setup({});
    const out = await service.bulkImportItems('t1', {
      rows: [row({ reorderLevel: '10', maxStock: '5' })],
    });
    expect(out.results[0].status).toBe('failed');
  });

  it('adds each variant once to the new item, ignoring case', async () => {
    const { service, tx } = setup({});
    await service.bulkImportItems('t1', {
      rows: [row({ variants: ['Small', 'Medium', 'small', ' Large '] })],
    });
    const [call] = tx.itemVariant.createMany.mock.calls[0] as [
      {
        data: { tenantId: string; itemId: string; name: string }[];
      },
    ];
    expect(call.data.map((v) => v.name)).toEqual(['Small', 'Medium', 'Large']);
    expect(call.data.every((v) => v.tenantId === 't1' && v.itemId.startsWith('item-'))).toBe(true);
  });

  it('adds no variants when the row has none', async () => {
    const { service, tx } = setup({});
    await service.bulkImportItems('t1', { rows: [row()] });
    expect(tx.itemVariant.createMany).not.toHaveBeenCalled();
  });
});
