import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';

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
});
