import 'reflect-metadata';
import { Controller, ExecutionContext, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { HttpLogEntry } from '../common/request-logging';
import { TrustedAuthGuard, TrustedAiRequest } from './trusted-auth.guard';
import { TrustedAuthModule } from './trusted-auth.module';
import { TrustedContextService } from './trusted-context.service';

const secret = 'local-test-gateway-shared-secret-only';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

@Controller('auth-canary')
@UseGuards(TrustedAuthGuard)
class TestOnlyController {
  @Get()
  read() {
    return { testFixture: true };
  }
}

describe('AI verification of signed WorkPhelo Gateway protocol fixtures', () => {
  const previousEnv = { ...process.env };
  let headers: Record<string, string>;
  let verifier: TrustedContextService;
  const claims = (token: string) => jwt.decode(token) as jwt.JwtPayload;
  const sign = (value: jwt.JwtPayload) =>
    jwt.sign(Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)), secret, {
      noTimestamp: value.iat === undefined,
    });
  const assertion = (changes: Record<string, unknown> = {}) => {
    headers['x-gateway-auth-context'] = sign({
      ...claims(headers['x-gateway-auth-context']),
      ...changes,
    });
  };
  const session = (changes: Record<string, unknown> = {}) => {
    const token = sign({ ...claims(headers.authorization.slice(7)), ...changes });
    headers.authorization = `Bearer ${token}`;
    assertion({ tokenHash: digest(token) });
  };
  const verify = () => verifier.verifyRequest({ headers } as Request);

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    process.env.AI_SERVICE_URL = 'http://ai.test:4011';
    process.env.AUTH_SERVICE_URL = 'http://auth.test:4001';
    const original = jwt.sign(
      {
        sub: 'user-a',
        tenantId: 'tenant-a',
        sessionVersion: 1,
        role: 'TENANT_ADMIN',
        permissions: ['payroll:APPROVE'],
      },
      secret,
      { expiresIn: '15m' },
    );
    const user = {
      id: 'user-a',
      tenantId: 'tenant-a',
      role: 'EMPLOYEE',
      email: 'test@example.test',
      tenantSlug: 'tenant-a',
      tenantName: 'Tenant A',
      firstName: 'Test',
      moduleConfig: { hr: false },
      featureConfig: { hr: { payroll: false } },
    };
    // Same jwt.sign fields/options as Gateway; fixtures are cryptographically signed,
    // not decoded objects accepted through a mocked verification function.
    headers = {
      authorization: `Bearer ${original}`,
      'x-user-permissions': '[]',
      'x-gateway-auth-context': jwt.sign(
        { user, permissionsHash: digest('[]'), tokenHash: digest(original) },
        secret,
        { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
      ),
    };
    verifier = new TrustedContextService(
      new ConfigService({
        AI_AUTHENTICATED_ROUTES_ENABLED: true,
        JWT_SECRET: secret,
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...previousEnv };
  });

  it('accepts a protocol-signed assertion and only its current authority', () => {
    expect(verify()).toMatchObject({
      id: 'user-a',
      tenantId: 'tenant-a',
      role: 'EMPLOYEE',
      permissions: [],
      moduleConfig: { hr: false },
    });
    // AI uses a bounded signed snapshot; it does not independently query Auth/DB.
    headers['x-user-permissions'] = '["employees:VIEW"]';
    expect(verify).toThrow('Unauthorized');
    assertion({ permissionsHash: digest(headers['x-user-permissions']) });
    expect(verify().permissions).toEqual(['employees:VIEW']);
  });

  it.each(['authorization', 'x-gateway-auth-context', 'x-user-permissions'])(
    'rejects a missing credential/binding: %s',
    (name) => {
      delete headers[name];
      expect(verify).toThrow('Unauthorized');
    },
  );
  it.each(['authorization', 'x-gateway-auth-context'])('rejects malformed %s', (name) => {
    headers[name] = 'not-a-token';
    expect(verify).toThrow('Unauthorized');
  });
  it.each(['session', 'assertion'])('rejects a forged %s signature', (kind) => {
    if (kind === 'session') {
      headers.authorization = `Bearer ${jwt.sign(claims(headers.authorization.slice(7)), 'wrong-key')}`;
    } else
      headers['x-gateway-auth-context'] = jwt.sign(
        claims(headers['x-gateway-auth-context']),
        'wrong-key',
      );
    expect(verify).toThrow('Unauthorized');
  });
  it.each(['session', 'assertion'])('rejects non-HS256 %s signatures', (kind) => {
    if (kind === 'session')
      headers.authorization = `Bearer ${jwt.sign(claims(headers.authorization.slice(7)), secret, { algorithm: 'HS384' })}`;
    else
      headers['x-gateway-auth-context'] = jwt.sign(
        claims(headers['x-gateway-auth-context']),
        secret,
        { algorithm: 'HS384' },
      );
    expect(verify).toThrow('Unauthorized');
  });
  it.each(['hr', 'marketing', 'accounting', 'reinsurance', 'inventory'])(
    'rejects audience %s',
    (aud) => {
      assertion({ aud });
      expect(verify).toThrow('Unauthorized');
    },
  );
  it.each([
    { iss: 'not-gateway' },
    { aud: undefined },
    { exp: undefined },
    { iat: undefined },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { iat: Math.floor(Date.now() / 1000) - 31, exp: Math.floor(Date.now() / 1000) + 1 },
    { iat: Math.floor(Date.now() / 1000) + 20, exp: Math.floor(Date.now() / 1000) + 30 },
    { exp: Math.floor(Date.now() / 1000) + 60 },
    { tokenHash: 'wrong' },
    { permissionsHash: 'wrong' },
    { scope: 'careers' },
    { type: 'service' },
  ])('rejects invalid assertion claims %p', (changes) => {
    assertion(changes);
    expect(verify).toThrow('Unauthorized');
  });
  it.each([
    { sub: '' },
    { tenantId: '' },
    { exp: undefined },
    { iat: undefined },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { iat: Math.floor(Date.now() / 1000) + 60 },
    { scope: 'careers' },
    { scope: 'unknown' },
    { scope: '' },
    { scope: null },
    { scope: ['careers'] },
    { type: 'refresh' },
    { type: 'service' },
    { iss: 'workphelo-gateway' },
    { aud: 'ai' },
  ])('independently rejects ineligible session claims %p', (changes) => {
    session(changes);
    expect(verify).toThrow('Unauthorized');
  });
  it.each([
    { id: 'different-user' },
    { tenantId: 'different-tenant' },
    { role: 'SERVICE' },
    { email: null },
    { moduleConfig: { hr: 'true' } },
    { featureConfig: null },
    { featureConfig: { hr: { payroll: 'true' } } },
    { integrationConfig: [] },
    { scope: 'careers' },
    { scope: null },
    { type: 'service' },
  ])('rejects malformed/mismatched signed identity %p', (changes) => {
    assertion({ user: { ...claims(headers['x-gateway-auth-context']).user, ...changes } });
    expect(verify).toThrow('Unauthorized');
  });
  it.each(['not json', '{}', '[123]', '[""]'])('rejects malformed permissions %s', (raw) => {
    headers['x-user-permissions'] = raw;
    assertion({ permissionsHash: digest(raw) });
    expect(verify).toThrow('Unauthorized');
  });
  it('ignores spoofed unsigned identity and replaces a preexisting request.user', () => {
    headers['x-user-id'] = 'attacker';
    headers['x-tenant-id'] = 'foreign';
    headers['x-user-role'] = 'SUPER_ADMIN';
    const req = { headers, user: { id: 'attacker' } } as TrustedAiRequest;
    const guard = new TrustedAuthGuard(verifier);
    expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext),
    ).toBe(true);
    expect(req.user).toMatchObject({ id: 'user-a', tenantId: 'tenant-a', role: 'EMPLOYEE' });
  });
  it('accepts the original JWT from parsed cookies', () => {
    const token = headers.authorization.slice(7);
    delete headers.authorization;
    expect(
      verifier.verifyRequest({ headers, cookies: { access_token: token } } as unknown as Request)
        .id,
    ).toBe('user-a');
  });
  it('clears a preexisting identity when verification fails', () => {
    const req = { headers: {}, user: { id: 'attacker' } } as TrustedAiRequest;
    expect(() =>
      new TrustedAuthGuard(verifier).canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as ExecutionContext),
    ).toThrow('Unauthorized');
    expect(req.user).toBeUndefined();
  });
  it.each([
    {},
    { AI_AUTHENTICATED_ROUTES_ENABLED: true },
    { AI_AUTHENTICATED_ROUTES_ENABLED: true, JWT_SECRET: ' ' },
  ])('fails closed when verification is disabled/unconfigured: %p', (config) => {
    delete process.env.JWT_SECRET;
    expect(() =>
      new TrustedContextService(new ConfigService(config)).verifyRequest({ headers } as Request),
    ).toThrow('Service Unavailable');
  });

  it('sanitizes HTTP failures and logs using a test-only authenticated controller', async () => {
    const entries: HttpLogEntry[] = [];
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ AI_AUTHENTICATED_ROUTES_ENABLED: true, JWT_SECRET: secret })],
        }),
        TrustedAuthModule,
      ],
      controllers: [TestOnlyController],
    }).compile();
    const app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApplication(app, (entry) => entries.push(entry));
    await app.init();
    try {
      await request(app.getHttpServer())
        .get('/api/auth-canary')
        .set(headers)
        .expect(200, { testFixture: true });
      await request(app.getHttpServer())
        .get('/api/auth-canary')
        .set('Cookie', `access_token=${headers.authorization.slice(7)}`)
        .set('x-gateway-auth-context', headers['x-gateway-auth-context'])
        .set('x-user-permissions', headers['x-user-permissions'])
        .expect(200, { testFixture: true });
      const response = await request(app.getHttpServer())
        .get('/api/auth-canary')
        .set({ ...headers, 'x-gateway-auth-context': 'private-forged-assertion' })
        .expect(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED', message: 'Request rejected' });
      const serialized = JSON.stringify({ entries, body: response.body as unknown });
      expect(serialized).not.toContain(headers.authorization.slice(7));
      expect(serialized).not.toContain(headers['x-gateway-auth-context']);
      expect(serialized).not.toContain('private-forged');
      expect(serialized).not.toContain(secret);
    } finally {
      await app.close();
    }
  });

  it('does not bypass the real global foundation policy, even with valid credentials and auth enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_POLICY_VERSION = 'test-v1';
    process.env.AI_ENABLED = 'false';
    process.env.AI_MOCK_ENABLED = 'false';
    process.env.AI_AUTHENTICATED_ROUTES_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true }), TrustedAuthModule],
      controllers: [TestOnlyController],
    }).compile();
    const app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApplication(app);
    await app.init();
    try {
      await request(app.getHttpServer()).get('/api/auth-canary').set(headers).expect(403);
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200, { status: 'ok', service: 'ai-service' });
      await request(app.getHttpServer())
        .get('/api/ready')
        .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
      for (const path of ['conversations', 'messages', 'generate']) {
        await request(app.getHttpServer())
          .get(`/api/${path}`)
          .set(headers)
          .expect(path === 'conversations' ? 503 : 404);
      }
    } finally {
      await app.close();
    }
  });
});
