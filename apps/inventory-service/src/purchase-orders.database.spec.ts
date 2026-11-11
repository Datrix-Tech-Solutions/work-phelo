import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests('Purchase orders - disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let service: InventoryService;
  let tenant: string;
  let supplier: string;
  let location: string;
  let widget: string;
  let milk: string; // perishable
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
    supplier = (await service.createParty(tenant, { kind: 'SUPPLIER', name: 'Acme' })).id;
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
    widget = await item('Widget', 'W');
    milk = await item('Milk', 'M', true);
  });
  const order = (lines: { itemId: string; quantity: string; unitCost: string }[], extra = {}) =>
    service.createPurchaseOrder(tenant, 'user-a', {
      orderDate: '2026-11-11',
      supplierId: supplier,
      locationId: location,
      lines,
      ...extra,
    });
  const receive = (id: string, lines: object[], dateReceived = '2026-11-15') =>
    service.receivePurchaseOrder(tenant, 'user-a', id, { dateReceived, lines } as never);
  const stock = async (itemId: string) =>
    (await prisma.stockBalance.findFirst({ where: { tenantId: tenant, itemId } }))?.quantity;

  it('creates an order without touching stock and generates a reference', async () => {
    const po = await order([{ itemId: widget, quantity: '100', unitCost: '1' }]);
    expect(po.status).toBe('ORDERED');
    expect(po.reference).toMatch(/^PO-20261111-/);
    expect(po.lines).toHaveLength(1);
    expect(await stock(widget)).toBeUndefined();
  });

  it('stocks and values the extra units but does not count them as owed', async () => {
    const po = await order([{ itemId: widget, quantity: '100', unitCost: '1' }]);
    const done = await receive(po.id, [
      { lineId: po.lines[0].id, receivedQuantity: '100', extraQuantity: '50' },
    ]);
    expect(done.status).toBe('RECEIVED');
    expect(done.lines[0].receivedQuantity.toString()).toBe('100');
    expect(done.lines[0].extraQuantity.toString()).toBe('50');
    expect((await stock(widget))?.toString()).toBe('150');
    const [m] = await service.movements(tenant);
    expect(m.type).toBe('STOCK_IN');
    expect(m.quantity.toString()).toBe('150');
    expect(m.unitCost?.toString()).toBe('1');
    expect(m.totalCost?.toString()).toBe('150');
    expect(m.reference).toBe(po.reference);
    expect(m.supplier).toBe('Acme');
    // owed = received x unit cost
    const owed = done.lines.reduce(
      (sum, l) => sum + Number(l.receivedQuantity) * Number(l.unitCost),
      0,
    );
    expect(owed).toBe(100);
  });

  it('receives in parts and tracks what is outstanding', async () => {
    const po = await order([{ itemId: widget, quantity: '100', unitCost: '2' }]);
    const lineId = po.lines[0].id;
    expect((await receive(po.id, [{ lineId, receivedQuantity: '60' }])).status).toBe(
      'PARTIALLY_RECEIVED',
    );
    await expect(receive(po.id, [{ lineId, receivedQuantity: '41' }])).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect((await receive(po.id, [{ lineId, receivedQuantity: '40' }])).status).toBe('RECEIVED');
    expect((await stock(widget))?.toString()).toBe('100');
    await expect(receive(po.id, [{ lineId, receivedQuantity: '1' }])).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a receipt with nothing on it', async () => {
    const po = await order([{ itemId: widget, quantity: '10', unitCost: '1' }]);
    await expect(
      receive(po.id, [{ lineId: po.lines[0].id, receivedQuantity: '0' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('needs an expiry date on receipt for a perishable item and posts nothing without it', async () => {
    const po = await order([
      { itemId: widget, quantity: '10', unitCost: '1' },
      { itemId: milk, quantity: '10', unitCost: '3' },
    ]);
    const [wLine, mLine] = [
      po.lines.find((l) => l.itemId === widget)!,
      po.lines.find((l) => l.itemId === milk)!,
    ];
    await expect(
      receive(po.id, [
        { lineId: wLine.id, receivedQuantity: '10' },
        { lineId: mLine.id, receivedQuantity: '10', lotNumber: 'L1' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await stock(widget)).toBeUndefined();
    expect((await service.getPurchaseOrder(tenant, po.id)).status).toBe('ORDERED');
    await receive(po.id, [
      { lineId: mLine.id, receivedQuantity: '10', lotNumber: 'L1', expiryDate: '2027-01-01' },
    ]);
    const lots = await service.lots(tenant, milk);
    expect(lots).toHaveLength(1);
    expect(lots[0].lotNumber).toBe('L1');
  });

  it('cancels an order only while nothing has been received', async () => {
    const a = await order([{ itemId: widget, quantity: '10', unitCost: '1' }]);
    expect((await service.cancelPurchaseOrder(tenant, a.id)).status).toBe('CANCELLED');
    await expect(
      receive(a.id, [{ lineId: a.lines[0].id, receivedQuantity: '5' }]),
    ).rejects.toBeInstanceOf(ConflictException);
    const b = await order([{ itemId: widget, quantity: '10', unitCost: '1' }]);
    await receive(b.id, [{ lineId: b.lines[0].id, receivedQuantity: '5' }]);
    await expect(service.cancelPurchaseOrder(tenant, b.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a duplicate reference, a customer as supplier, and a repeated item line', async () => {
    await order([{ itemId: widget, quantity: '1', unitCost: '1' }], { reference: 'PO-1' });
    await expect(
      order([{ itemId: widget, quantity: '1', unitCost: '1' }], { reference: 'PO-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const customer = (await service.createParty(tenant, { kind: 'CUSTOMER', name: 'Cust' })).id;
    await expect(
      order([{ itemId: widget, quantity: '1', unitCost: '1' }], { supplierId: customer }),
    ).rejects.toThrow('Supplier not found');
    await expect(
      order([
        { itemId: widget, quantity: '1', unitCost: '1' },
        { itemId: widget, quantity: '2', unitCost: '1' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
