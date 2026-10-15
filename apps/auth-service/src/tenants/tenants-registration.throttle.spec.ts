import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { TenantsController } from './tenants.controller';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

describe('public tenant registration throttling', () => {
  let app: INestApplication;
  const register = jest
    .fn()
    .mockResolvedValue({ status: 'PENDING_VERIFICATION' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 60_000, limit: 100 },
        ]),
      ],
      controllers: [TenantsController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: TenantLifecycleService,
          useValue: { register },
        },
        { provide: TenantConfigService, useValue: {} },
        { provide: TenantAdminService, useValue: {} },
        { provide: TenantBrandingService, useValue: {} },
      ],
    })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects the third rapid anonymous registration with 429', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app.getHttpServer())
        .post('/tenants/register')
        .send({})
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/tenants/register')
      .send({})
      .expect(429);
    expect(register).toHaveBeenCalledTimes(2);
  });
});
