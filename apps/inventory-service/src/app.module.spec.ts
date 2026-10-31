import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ModuleGuard } from './auth/guards/module.guard';
import { FeatureGuard } from './auth/guards/feature.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { InternalServiceAuthGuard } from './auth/internal-service-auth';

describe('Inventory scaffold HTTP application', () => {
  let app: INestApplication<Server>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('boots with the normal security providers and no persistence/messaging modules', () => {
    for (const guard of [
      JwtAuthGuard,
      ModuleGuard,
      FeatureGuard,
      PermissionsGuard,
      InternalServiceAuthGuard,
    ]) {
      expect(app.get<unknown>(guard)).toBeDefined();
    }
  });
  it('serves public process health without tokens or invented tenant entitlements', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    const body = response.body as Record<string, unknown>;
    expect(body).toEqual({
      status: 'ok',
      service: 'inventory-service',
      timestamp: body.timestamp,
    });
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['service', 'status', 'timestamp']);
  });
  it('does not expose forwarded headers, configuration or sensitive errors in health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Authorization', 'Bearer invalid')
      .set('x-gateway-auth-context', 'forged')
      .set('x-tenant-id', 'attacker')
      .expect(200);
    expect(JSON.stringify(response.body)).not.toMatch(
      /attacker|forged|DATABASE_URL|JWT_SECRET|stack/,
    );
  });
  it('has no scaffold business APIs or accidental bare-prefix routes', async () => {
    await request(app.getHttpServer()).get('/api/items').expect(404);
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
