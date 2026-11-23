import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { buildAuthHeaders } from '@work-phelo/internal-auth';
import { DriverLicenceService } from '../employees/driver-licence.service';
import { DirectoryService } from './directory.service';
import { InternalDirectoryController } from './internal-directory.controller';

describe('Marketing to HR production signed directory contract', () => {
  const original = { ...process.env };
  const secret = 'synthetic-rollout-internal-secret-only-32';
  const tenant = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const path = '/internal/employee-directory';
  const directory = {
    list: jest.fn().mockResolvedValue([]),
    resolve: jest.fn().mockResolvedValue({ person: null, people: [] }),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InternalDirectoryController],
      providers: [
        { provide: DirectoryService, useValue: directory },
        { provide: DriverLicenceService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_AUTH_SECRET = secret;
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'marketing-service';
    process.env.INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE = 'true';
  });
  afterAll(async () => {
    await app?.close();
    process.env = original;
  });

  const headers = (method = 'GET', body?: object) =>
    buildAuthHeaders({
      secret,
      serviceName: 'marketing-service',
      method,
      path: body ? path + '/resolve' : path,
      signRequest: { query: body ? [] : [['tenantId', tenant]], body },
    });

  it('accepts Marketing signed requests and forwards only the authenticated tenant query', async () => {
    await request(app.getHttpServer())
      .get(path)
      .query({ tenantId: tenant })
      .set(headers())
      .expect(200);
    expect(directory.list).toHaveBeenCalledWith(tenant);
  });
  it('rejects unsigned callers before accessing HR data', async () => {
    await request(app.getHttpServer())
      .get(path)
      .query({ tenantId: tenant })
      .expect(401);
    expect(directory.list).not.toHaveBeenCalled();
  });
  it('fails closed when receiver credentials were not forwarded', async () => {
    delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    await request(app.getHttpServer())
      .get(path)
      .query({ tenantId: tenant })
      .set(headers())
      .expect(401);
    expect(directory.list).not.toHaveBeenCalled();
  });
  it('requires Marketing in the receiver allowlist', async () => {
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'accounting-service';
    await request(app.getHttpServer())
      .get(path)
      .query({ tenantId: tenant })
      .set(headers())
      .expect(401);
  });
  it('rejects a substituted tenant query', async () => {
    await request(app.getHttpServer())
      .get(path)
      .query({ tenantId: other })
      .set(headers())
      .expect(401);
    expect(directory.list).not.toHaveBeenCalled();
  });
  it('accepts correctly signed tenant-scoped resolve requests', async () => {
    const body = { tenantId: tenant, userId: 'user-a' };
    await request(app.getHttpServer())
      .post(path + '/resolve')
      .set(headers('POST', body))
      .send(body)
      .expect(201);
    expect(directory.resolve).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ userId: 'user-a' }),
    );
  });
  it('rejects substituted tenant bodies before resolving an employee', async () => {
    const body = { tenantId: tenant, userId: 'user-a' };
    await request(app.getHttpServer())
      .post(path + '/resolve')
      .set(headers('POST', body))
      .send({ ...body, tenantId: other })
      .expect(401);
    expect(directory.resolve).not.toHaveBeenCalled();
  });
});
