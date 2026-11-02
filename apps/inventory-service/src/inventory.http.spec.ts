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

describe('Inventory HTTP authorization and validation', () => {
  let app: INestApplication<Server>;
  const secret = 'inventory-http-test-only';
  const oldSecret = process.env.JWT_SECRET;
  const id = '13301ca4-426d-4f48-bb44-f606d9698275';
  const service = {
    createCategory: jest.fn().mockResolvedValue({ id }),
    createUnit: jest.fn().mockResolvedValue({ id }),
    createLocation: jest.fn().mockResolvedValue({ id }),
    createItem: jest.fn().mockResolvedValue({ id }),
    updateItem: jest.fn().mockResolvedValue({ id }),
    stockIn: jest.fn().mockResolvedValue({ movement: { id } }),
  };
  function headers(permission: string, tenantId = 'tenant-a', enabled = true) {
    const token = jwt.sign({ sub: 'user-a', tenantId }, secret);
    const permissions = JSON.stringify(permission ? [permission] : []);
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

  it.each(['categories', 'units', 'locations', 'items', 'stock-in'])(
    'denies unauthenticated %s',
    async (route) => {
      await request(app.getHttpServer())
        .post('/api/' + route)
        .send({})
        .expect(401);
    },
  );
  it.each(['categories', 'units', 'locations', 'items', 'stock-in'])(
    'denies missing %s permission',
    async (route) => {
      await request(app.getHttpServer())
        .post('/api/' + route)
        .set(headers(''))
        .send({})
        .expect(403);
    },
  );
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
});
