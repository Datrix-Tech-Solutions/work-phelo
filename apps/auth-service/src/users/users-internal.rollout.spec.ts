import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { UsersInternalController } from './users-internal.controller';

describe('Marketing to Auth production user-directory contract', () => {
  const original = { ...process.env };
  const tenant = '11111111-1111-4111-8111-111111111111';
  const user = '33333333-3333-4333-8333-333333333333';
  const secret = 'synthetic-rollout-internal-secret-only-32';
  const path = `/internal/tenants/${tenant}/users`;
  const findMany = jest.fn().mockResolvedValue([]);
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersInternalController],
      providers: [{ provide: PrismaService, useValue: { user: { findMany } } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    findMany.mockClear();
    process.env.INTERNAL_SERVICE_AUTH_SECRET = secret;
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'marketing-service';
  });
  afterAll(async () => {
    await app?.close();
    process.env = original;
  });
  const headers = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    return {
      'x-workphelo-service': 'marketing-service',
      'x-workphelo-timestamp': timestamp,
      'x-workphelo-signature': createHmac('sha256', secret)
        .update(['marketing-service', timestamp, 'GET', path].join(':'))
        .digest('hex'),
    };
  };
  it('accepts an allowlisted signed request with tenant-scoped database predicates', async () => {
    await request(app.getHttpServer())
      .get(path)
      .query({ ids: user })
      .set(headers())
      .expect(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenant, id: { in: [user] } },
      }),
    );
  });
  it('rejects a substituted tenant path', async () => {
    await request(app.getHttpServer())
      .get(path.replace(tenant, '22222222-2222-4222-8222-222222222222'))
      .query({ ids: user })
      .set(headers())
      .expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects calls without receiver allowlisting', async () => {
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'accounting-service';
    await request(app.getHttpServer())
      .get(path)
      .query({ ids: user })
      .set(headers())
      .expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
