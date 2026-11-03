import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Server } from 'http';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockOutPurpose, StockAdjustmentReason } from '../prisma/generated/client';

describe('Inventory HTTP authorization and validation', () => {
  let app: INestApplication<Server>;
  const secret = 'inventory-http-test-only';
  const oldSecret = process.env.JWT_SECRET;
  const id = '13301ca4-426d-4f48-bb44-f606d9698275';
  const service = {
    createCategory: jest.fn().mockResolvedValue({ id }),
    createUnit: jest.fn().mockResolvedValue({ id }),
    createLocation: jest.fn().mockResolvedValue({ id }),
    updateCategory: jest.fn().mockResolvedValue({ id }),
    updateUnit: jest.fn().mockResolvedValue({ id }),
    updateLocation: jest.fn().mockResolvedValue({ id }),
    createItem: jest.fn().mockResolvedValue({ id }),
    updateItem: jest.fn().mockResolvedValue({ id }),
    stockIn: jest.fn().mockResolvedValue({ movement: { id } }),
    stockOut: jest.fn().mockResolvedValue({ movement: { id } }),
    transfer: jest.fn().mockResolvedValue({ transferId: id }),
    movements: jest.fn().mockResolvedValue([]),
    adjust: jest.fn().mockResolvedValue({ movement: { id } }),
    balances: jest.fn().mockResolvedValue([]),
  };
  function headers(permission: string | string[], tenantId = 'tenant-a', enabled = true) {
    const token = jwt.sign({ sub: 'user-a', tenantId }, secret);
    const permissions = JSON.stringify(
      Array.isArray(permission) ? permission : permission ? [permission] : [],
    );
    const hash = (v: string) => createHash('sha256').update(v).digest('hex');
    return {
      Authorization: 'Bearer ' + token,
      'x-user-permissions': permissions,
      'x-gateway-auth-context': jwt.sign(
        {
          user: {
            id: 'user-a',
            tenantId,
            role: 'EMPLOYEE',
            email: 'a@example.test',
            tenantSlug: 'acme',
            tenantName: 'Acme',
            firstName: 'A',
            moduleConfig: { operations: enabled },
            featureConfig: {},
          },
          tokenHash: hash(token),
          permissionsHash: hash(permissions),
        },
        secret,
        { issuer: 'workphelo-gateway', audience: 'inventory', expiresIn: 30 },
      ),
    };
  }
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(InventoryService)
      .useValue(service)
      .compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  beforeEach(() => jest.clearAllMocks());
  it('documents all item and receipt request fields in OpenAPI', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const itemSchema = document.components?.schemas?.ItemDto;
    expect(itemSchema).toHaveProperty('properties.sku');
    expect(itemSchema).toHaveProperty('properties.categoryId');
    expect(itemSchema).toHaveProperty('properties.unitOfMeasureId');
    expect(itemSchema).toHaveProperty('properties.reorderLevel');
    expect(itemSchema).toHaveProperty('properties.sellingPrice');
    expect(document.components?.schemas?.StockInDto).toHaveProperty('properties.dateReceived');
  });

  it.each([
    'categories',
    'units',
    'locations',
    'items',
    'stock-in',
    'stock-out',
    'stock-transfers',
  ])('denies unauthenticated %s', async (route) => {
    await request(app.getHttpServer())
      .post('/api/' + route)
      .send({})
      .expect(401);
  });
  it.each([
    'categories',
    'units',
    'locations',
    'items',
    'stock-in',
    'stock-out',
    'stock-transfers',
  ])('denies missing %s permission', async (route) => {
    await request(app.getHttpServer())
      .post('/api/' + route)
      .set(headers(''))
      .send({})
      .expect(403);
  });
  it('enforces Operations entitlement even with a correct grant', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set(headers('operations.inventory.categories:CREATE', 'tenant-a', false))
      .send({ name: 'Office' })
      .expect(403);
  });
  it.each(['categories', 'units', 'locations'])(
    'accepts authorized %s and derives tenant only from context',
    async (route) => {
      const data =
        route === 'locations' ? { name: ' Main ', type: 'WAREHOUSE' } : { name: ' Main ' };
      await request(app.getHttpServer())
        .post('/api/' + route)
        .set(headers('operations.inventory.' + route + ':CREATE', 'tenant-b'))
        .send(data)
        .expect(201);
      const mock =
        route === 'categories'
          ? service.createCategory
          : route === 'units'
            ? service.createUnit
            : service.createLocation;
      expect(mock).toHaveBeenCalledWith('tenant-b', expect.objectContaining({ name: 'Main' }));
      await request(app.getHttpServer())
        .post('/api/' + route)
        .set(headers('operations.inventory.' + route + ':CREATE'))
        .send({ ...data, tenantId: 'spoofed' })
        .expect(400);
    },
  );
  it.each(['', '   ', null])('rejects empty/null name %p', async (name) => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set(headers('operations.inventory.categories:CREATE'))
      .send({ name })
      .expect(400);
  });
  it('rejects unsupported location type', async () => {
    await request(app.getHttpServer())
      .post('/api/locations')
      .set(headers('operations.inventory.locations:CREATE'))
      .send({ name: 'Main', type: 'BIN' })
      .expect(400);
  });
  const item = { name: 'Paper', sku: 'P-1', categoryId: id, unitOfMeasureId: id };
  it.each(['name', 'sku', 'categoryId', 'unitOfMeasureId'])('requires item %s', async (field) => {
    const data: Record<string, unknown> = { ...item };
    delete data[field];
    await request(app.getHttpServer())
      .post('/api/items')
      .set(headers('operations.inventory.items:CREATE'))
      .send(data)
      .expect(400);
  });
  it.each(['costPrice', 'sellingPrice', 'reorderLevel'])('rejects negative %s', async (field) => {
    await request(app.getHttpServer())
      .post('/api/items')
      .set(headers('operations.inventory.items:CREATE'))
      .send({ ...item, [field]: '-0.01' })
      .expect(400);
  });
  it('accepts item values and ACTIVE/INACTIVE updates but rejects null required fields', async () => {
    await request(app.getHttpServer())
      .post('/api/items')
      .set(headers('operations.inventory.items:CREATE'))
      .send({ ...item, costPrice: 0, sellingPrice: '1.2345', reorderLevel: '0' })
      .expect(201);
    for (const status of ['ACTIVE', 'INACTIVE']) {
      await request(app.getHttpServer())
        .patch('/api/items/' + id)
        .set(headers('operations.inventory.items:EDIT'))
        .send({ status })
        .expect(200);
    }
    for (const data of [
      { status: 'DELETED' },
      { sku: null },
      { name: null },
      { categoryId: null },
    ]) {
      await request(app.getHttpServer())
        .patch('/api/items/' + id)
        .set(headers('operations.inventory.items:EDIT'))
        .send(data)
        .expect(400);
    }
  });
  const receipt = { itemId: id, locationId: id, quantity: '1', dateReceived: '2026-11-02' };
  it.each(['0', '0.0000', '-1', '1.00001', '100000000000000'])(
    'rejects quantity %s',
    async (quantity) => {
      await request(app.getHttpServer())
        .post('/api/stock-in')
        .set(headers('operations.inventory.stock-in:CREATE'))
        .send({ ...receipt, quantity })
        .expect(400);
    },
  );
  it.each([
    { dateReceived: undefined },
    { dateReceived: 'invalid' },
    { dateReceived: '2026-02-30' },
    { unitCost: '-1' },
    { unitOfMeasureId: id },
  ])('rejects invalid receipt %j', async (extra) => {
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set(headers('operations.inventory.stock-in:CREATE'))
      .send({ ...receipt, ...extra })
      .expect(400);
  });
  it('passes only trusted creator/tenant and valid exact-decimal receipt fields', async () => {
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set(headers('operations.inventory.stock-in:CREATE'))
      .send({ ...receipt, quantity: 1.25, unitCost: '0.1' })
      .expect(201);
    expect(service.stockIn).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      expect.objectContaining({ quantity: '1.25', unitCost: '0.1' }),
    );
  });

  it.each([
    ['categories', { name: 'Office', description: 'Supplies', icon: 'box', status: 'INACTIVE' }],
    ['units', { name: 'Each', symbol: 'ea', description: 'Individual', status: 'ACTIVE' }],
    ['locations', { name: 'Main', code: ' main ', address: 'Accra', status: 'ACTIVE' }],
  ])('accepts %s settings for create and PATCH', async (resource, payload) => {
    await request(app.getHttpServer())
      .post('/api/' + resource)
      .set(headers(`operations.inventory.${resource}:CREATE`, 'tenant-b'))
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .patch('/api/' + resource + '/' + id)
      .set(headers(`operations.inventory.${resource}:EDIT`, 'tenant-b'))
      .send(payload)
      .expect(200);
    if (resource === 'locations') {
      expect(service.createLocation).toHaveBeenCalledWith(
        'tenant-b',
        expect.objectContaining({ code: 'MAIN' }),
      );
      expect(service.updateLocation).toHaveBeenCalledWith(
        'tenant-b',
        id,
        expect.objectContaining({ code: 'MAIN' }),
      );
    }
  });
  it.each(['categories', 'units', 'locations'])(
    'preserves legacy name-only %s payloads',
    async (resource) => {
      await request(app.getHttpServer())
        .post('/api/' + resource)
        .set(headers(`operations.inventory.${resource}:CREATE`))
        .send({ name: 'Legacy' })
        .expect(201);
    },
  );
  it.each<[string, Record<string, unknown>]>([
    ['categories', { icon: 'x'.repeat(101) }],
    ['categories', { description: 'x'.repeat(4001) }],
    ['units', { symbol: '' }],
    ['units', { symbol: ' ' }],
    ['units', { symbol: null }],
    ['units', { symbol: 'x'.repeat(11) }],
    ['locations', { code: '' }],
    ['locations', { code: null }],
    ['locations', { code: 'x'.repeat(51) }],
    ['locations', { type: null }],
    ['locations', { type: 'INVALID' }],
    ['locations', { address: 'x'.repeat(4001) }],
    ...['categories', 'units', 'locations'].flatMap<[string, Record<string, unknown>]>(
      (resource) => [
        [resource, { status: null }],
        [resource, { status: 'INVALID' }],
        [resource, { itemCount: 5 }],
        [resource, { tenantId: 'spoofed' }],
        [resource, { createdAt: '2026-11-03' }],
        [resource, { updatedAt: '2026-11-03' }],
      ],
    ),
    ['locations', { stockValue: 100 }],
  ])('rejects invalid/server-owned %s setting fields %j', async (resource, extra) => {
    for (const method of ['post', 'patch'] as const) {
      await request(app.getHttpServer())
        [method]('/api/' + String(resource) + (method === 'patch' ? '/' + id : ''))
        .set(
          headers(
            `operations.inventory.${String(resource)}:${method === 'patch' ? 'EDIT' : 'CREATE'}`,
          ),
        )
        .send({ name: 'Config', ...(extra as object) })
        .expect(400);
    }
  });

  const adjustment = {
    itemId: id,
    locationId: id,
    quantity: '1',
    date: '2026-11-03',
    type: 'INCREASE',
    reason: 'DATA_CORRECTION',
  };
  it('requires authentication, CREATE permission and Operations for adjustments', async () => {
    await request(app.getHttpServer()).post('/api/stock-adjustments').send(adjustment).expect(401);
    await request(app.getHttpServer())
      .post('/api/stock-adjustments')
      .set(headers(''))
      .send(adjustment)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/stock-adjustments')
      .set(headers('operations.inventory.adjustments:CREATE', 'tenant-a', false))
      .send(adjustment)
      .expect(403);
    expect(service.adjust).not.toHaveBeenCalled();
  });
  it.each(Object.values(StockAdjustmentReason))('accepts adjustment reason %s', async (reason) => {
    for (const type of ['INCREASE', 'DECREASE']) {
      await request(app.getHttpServer())
        .post('/api/stock-adjustments')
        .set(headers('operations.inventory.adjustments:CREATE', 'tenant-b'))
        .send({ ...adjustment, type, reason })
        .expect(201);
      expect(service.adjust).toHaveBeenLastCalledWith(
        'tenant-b',
        'user-a',
        expect.objectContaining({ type, reason }),
      );
    }
  });
  it.each([
    { reason: undefined },
    { reason: null },
    { reason: 'INVALID' },
    { type: undefined },
    { type: 'STOCK_IN' },
    { type: null },
    { quantity: '0' },
    { quantity: '-1' },
    { quantity: '1.00001' },
    { date: undefined },
    { date: '2026-02-30' },
    { unitOfMeasureId: id },
    { unitCost: '1' },
    { tenantId: 'spoof' },
    { createdBy: 'spoof' },
  ])('rejects invalid adjustment payload %j', async (extra) => {
    await request(app.getHttpServer())
      .post('/api/stock-adjustments')
      .set(headers('operations.inventory.adjustments:CREATE'))
      .send({ ...adjustment, ...extra })
      .expect(400);
    expect(service.adjust).not.toHaveBeenCalled();
  });
  it('requires items VIEW for balance reporting and validates status', async () => {
    await request(app.getHttpServer()).get('/api/stock-balances').set(headers('')).expect(403);
    for (const status of ['LOW_STOCK', 'OUT_OF_STOCK']) {
      await request(app.getHttpServer())
        .get('/api/stock-balances?status=' + status)
        .set(headers('operations.inventory.items:VIEW', 'tenant-b'))
        .expect(200);
      expect(service.balances).toHaveBeenLastCalledWith('tenant-b', status);
    }
    await request(app.getHttpServer())
      .get('/api/stock-balances')
      .set(headers('operations.inventory.items:VIEW'))
      .expect(200);
    expect(service.balances).toHaveBeenLastCalledWith('tenant-a', undefined);
    service.balances.mockClear();
    await request(app.getHttpServer())
      .get('/api/stock-balances?status=INVALID')
      .set(headers('operations.inventory.items:VIEW'))
      .expect(400);
    expect(service.balances).not.toHaveBeenCalled();
  });
  it('includes only adjustment history with adjustments VIEW, not CREATE', async () => {
    await request(app.getHttpServer())
      .get('/api/stock-movements')
      .set(headers('operations.inventory.adjustments:VIEW'))
      .expect(200);
    expect(service.movements).toHaveBeenCalledWith('tenant-a', [
      'ADJUSTMENT_INCREASE',
      'ADJUSTMENT_DECREASE',
    ]);
    service.movements.mockClear();
    await request(app.getHttpServer())
      .get('/api/stock-movements')
      .set(headers('operations.inventory.adjustments:CREATE'))
      .expect(403);
    expect(service.movements).not.toHaveBeenCalled();
  });

  const issue = {
    itemId: id,
    locationId: id,
    quantity: '1.25',
    date: '2026-11-02',
    purpose: 'INTERNAL_USE',
  };
  const transfer = {
    itemId: id,
    sourceLocationId: id,
    destinationLocationId: 'f908c2a8-686e-4902-91fd-67d8839bca19',
    quantity: '1.25',
    date: '2026-11-02',
  };
  it.each(Object.values(StockOutPurpose))(
    'accepts purpose %s and trusted tenant/creator',
    async (purpose) => {
      await request(app.getHttpServer())
        .post('/api/stock-out')
        .set(headers('operations.inventory.stock-out:CREATE', 'tenant-b'))
        .send({ ...issue, purpose, recipient: 'Team', reference: 'ISSUE-1', notes: 'Approved use' })
        .expect(201);
      expect(service.stockOut).toHaveBeenCalledWith(
        'tenant-b',
        'user-a',
        expect.objectContaining({ purpose, recipient: 'Team' }),
      );
    },
  );
  it.each([undefined, null, ''])('requires Stock Out purpose %p', async (purpose) => {
    await request(app.getHttpServer())
      .post('/api/stock-out')
      .set(headers('operations.inventory.stock-out:CREATE'))
      .send({ ...issue, purpose })
      .expect(400);
    expect(service.stockOut).not.toHaveBeenCalled();
  });
  it('accepts authorized transfer with only trusted tenant/creator', async () => {
    await request(app.getHttpServer())
      .post('/api/stock-transfers')
      .set(headers('operations.inventory.transfers:CREATE', 'tenant-b'))
      .send(transfer)
      .expect(201);
    expect(service.transfer).toHaveBeenCalledWith(
      'tenant-b',
      'user-a',
      expect.objectContaining(transfer),
    );
  });
  it.each(['stock-out', 'stock-transfers'])('denies disabled Operations on %s', async (route) => {
    const resource = route === 'stock-out' ? 'stock-out' : 'transfers';
    await request(app.getHttpServer())
      .post('/api/' + route)
      .set(headers('operations.inventory.' + resource + ':CREATE', 'tenant-a', false))
      .send(route === 'stock-out' ? issue : transfer)
      .expect(403);
  });
  it.each(['0', '-1', '1.00001'])(
    'rejects invalid issue/transfer quantity %s',
    async (quantity) => {
      await request(app.getHttpServer())
        .post('/api/stock-out')
        .set(headers('operations.inventory.stock-out:CREATE'))
        .send({ ...issue, quantity })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/stock-transfers')
        .set(headers('operations.inventory.transfers:CREATE'))
        .send({ ...transfer, quantity })
        .expect(400);
    },
  );
  it.each([
    { date: undefined },
    { date: '2026-02-30' },
    { unitOfMeasureId: id },
    { tenantId: 'spoofed' },
    { createdBy: 'spoofed' },
    { unitCost: '2' },
  ])('rejects invalid or caller-owned issue/transfer fields %j', async (extra) => {
    await request(app.getHttpServer())
      .post('/api/stock-out')
      .set(headers('operations.inventory.stock-out:CREATE'))
      .send({ ...issue, ...extra })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/stock-transfers')
      .set(headers('operations.inventory.transfers:CREATE'))
      .send({ ...transfer, ...extra })
      .expect(400);
  });
  it.each([
    ['stock-in', ['STOCK_IN']],
    ['stock-out', ['STOCK_OUT']],
    ['transfers', ['TRANSFER_OUT', 'TRANSFER_IN']],
  ])('restricts shared history to the %s VIEW grant', async (resource, types) => {
    await request(app.getHttpServer())
      .get('/api/stock-movements')
      .set(headers('operations.inventory.' + String(resource) + ':VIEW'))
      .expect(200);
    expect(service.movements).toHaveBeenCalledWith('tenant-a', types);
  });
  it('allows combined history grants but never treats CREATE as VIEW', async () => {
    await request(app.getHttpServer())
      .get('/api/stock-movements')
      .set(
        headers([
          'operations.inventory.stock-in:VIEW',
          'operations.inventory.stock-out:VIEW',
          'operations.inventory.transfers:VIEW',
        ]),
      )
      .expect(200);
    expect(service.movements).toHaveBeenCalledWith('tenant-a', [
      'STOCK_IN',
      'STOCK_OUT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
    service.movements.mockClear();
    await request(app.getHttpServer())
      .get('/api/stock-movements')
      .set(headers('operations.inventory.stock-out:CREATE'))
      .expect(403);
    expect(service.movements).not.toHaveBeenCalled();
  });
});
