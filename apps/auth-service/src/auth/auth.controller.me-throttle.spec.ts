import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AddressInfo } from 'net';
import { TenantAssetStorageService } from '../tenants/tenant-asset-storage.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('Auth /me under load from the Gateway', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        // The same names and limits as AppModule.
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 60000, limit: 100 },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: AuthService,
          useValue: { signAccessToken: () => 'test-access-token' },
        },
        {
          provide: TenantAssetStorageService,
          useValue: { resolveAvatarReadUrl: () => Promise.resolve(null) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): { user?: unknown } };
        }) => {
          context.switchToHttp().getRequest().user = { id: 'user' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const { port } = (
      app.getHttpServer() as { address(): AddressInfo }
    ).address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function statuses(count: number, path: string, method = 'GET') {
    const seen: number[] = [];
    for (let i = 0; i < count; i++) {
      const res = await fetch(baseUrl + path, { method });
      await res.arrayBuffer();
      seen.push(res.status);
    }
    return seen;
  }

  it('is not limited by either global throttle', async () => {
    expect(new Set(await statuses(120, '/me'))).toEqual(new Set([200]));
  });

  it('leaves the global throttle on other endpoints', async () => {
    expect(await statuses(15, '/refresh', 'POST')).toContain(429);
  });
});
