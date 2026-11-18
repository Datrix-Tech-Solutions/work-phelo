import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Server } from 'http';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { INFERENCE_PROVIDER } from '../inference/inference-provider';
import { HttpLogEntry } from '../common/request-logging';

@Controller('undeclared-eligibility-test')
class UndeclaredController {
  @Get()
  read() {
    throw new Error('Undeclared controller must never execute');
  }
}

describe('Eligibility through the real Nest global handler/authentication chain', () => {
  const previousEnv = { ...process.env };
  const secret = 'local-eligibility-test-shared-secret';
  let app: INestApplication<Server>;
  let entries: HttpLogEntry[];
  const generateText = jest.fn(() => {
    throw new Error('Eligibility must never infer');
  });
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  function credentials(
    session: Record<string, unknown> = {},
    context: Record<string, unknown> = {},
    user: Record<string, unknown> = {},
  ) {
    const token = jwt.sign(
      { sub: 'user-a', tenantId: 'tenant-a', role: 'TENANT_ADMIN', ...session },
      secret,
      { expiresIn: '15m' },
    );
    const signed = jwt.sign(
      {
        user: {
          id: 'user-a',
          tenantId: 'tenant-a',
          role: 'EMPLOYEE',
          email: 'test@example.test',
          firstName: 'Test',
          tenantName: 'Tenant A',
          tenantSlug: 'tenant-a',
          moduleConfig: { hr: false },
          featureConfig: {},
          ...user,
        },
        permissionsHash: hash('[]'),
        tokenHash: hash(token),
        ...context,
      },
      secret,
      { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
    );
    return {
      authorization: `Bearer ${token}`,
      'x-gateway-auth-context': signed,
      'x-user-permissions': '[]',
    };
  }
  async function createApp() {
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
      controllers: [UndeclaredController],
    })
      .overrideProvider(INFERENCE_PROVIDER)
      .useValue({ generateText })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApplication(app, (entry) => entries.push(entry));
    await app.init();
  }
  beforeEach(async () => {
    process.env = {
      NODE_ENV: 'production',
      AI_PROVIDER: 'mock',
      AI_POLICY_VERSION: 'eligibility-test-v1',
      AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
      JWT_SECRET: secret,
    };
    entries = [];
    generateText.mockClear();
    await createApp();
  });
  afterEach(async () => {
    await app.close();
    process.env = { ...previousEnv };
    expect(generateText).not.toHaveBeenCalled();
  });

  it.each(['EMPLOYEE', 'TENANT_ADMIN', 'SUPER_ADMIN'])(
    'allows a signed active tenant-user %s without module permissions or inference',
    async (role) => {
      // Gateway/Auth own ACTIVE/session checks; these are signed protocol fixtures, not DB checks.
      await request(app.getHttpServer())
        .get('/api/eligibility')
        .set(credentials({}, {}, { role }))
        .expect('Cache-Control', 'no-store')
        .expect(200, { eligible: true, inferenceAvailable: false });
    },
  );
  it('defaults to disabled even with otherwise valid credentials', async () => {
    await app.close();
    delete process.env.AI_AUTHENTICATED_ROUTES_ENABLED;
    delete process.env.JWT_SECRET;
    await createApp();
    await request(app.getHttpServer())
      .get('/api/eligibility')
      .set(credentials())
      .expect('Cache-Control', 'no-store')
      .expect(503);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
  it.each(['authorization', 'x-gateway-auth-context', 'x-user-permissions'])(
    'rejects missing %s',
    async (name) => {
      const headers: Record<string, string> = credentials();
      delete headers[name];
      await request(app.getHttpServer())
        .get('/api/eligibility')
        .set(headers)
        .expect('Cache-Control', 'no-store')
        .expect(401);
    },
  );
  it.each(['authorization', 'x-gateway-auth-context'])('rejects forged %s safely', async (name) => {
    const headers: Record<string, string> = credentials();
    headers[name] = 'private-forgery';
    const res = await request(app.getHttpServer())
      .get('/api/eligibility?private-query=secret')
      .set(headers)
      .expect(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Request rejected',
    });
    expect(JSON.stringify({ body: res.body as unknown, entries })).not.toMatch(
      /private-forgery|private-query|local-eligibility-test/,
    );
  });
  it.each(['careers', 'unsupported', null, '', ['careers']])(
    'rejects session scope %p',
    async (scope) => {
      await request(app.getHttpServer())
        .get('/api/eligibility')
        .set(credentials({ scope }))
        .expect(401);
    },
  );
  it('rejects non-user tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/eligibility')
      .set(credentials({ type: 'refresh' }))
      .expect(401);
  });
  it.each([
    { tokenHash: 'mismatch' },
    { permissionsHash: 'mismatch' },
    { iat: Math.floor(Date.now() / 1000) - 60 },
    { iat: Math.floor(Date.now() / 1000) + 60 },
  ])('rejects invalid timing/binding %p', async (context) => {
    await request(app.getHttpServer())
      .get('/api/eligibility')
      .set(credentials({}, context))
      .expect(401);
  });
  it.each([{ id: 'other-user' }, { tenantId: 'other-tenant' }])(
    'rejects signed identity mismatch %p',
    async (user) => {
      await request(app.getHttpServer())
        .get('/api/eligibility')
        .set(credentials({}, {}, user))
        .expect(401);
    },
  );
  it('rejects a wrong-service assertion', async () => {
    const headers = credentials();
    const claims = jwt.decode(headers['x-gateway-auth-context']) as jwt.JwtPayload;
    headers['x-gateway-auth-context'] = jwt.sign({ ...claims, aud: 'hr' }, secret);
    await request(app.getHttpServer()).get('/api/eligibility').set(headers).expect(401);
  });
  it('does not expose caller identity or signed claims in success', async () => {
    await request(app.getHttpServer())
      .get('/api/eligibility')
      .set(credentials())
      .set('x-user-id', 'attacker')
      .set('x-tenant-id', 'foreign')
      .set('x-user-role', 'SUPER_ADMIN')
      .expect(200, { eligible: true, inferenceAvailable: false });
  });
  it.each(['post', 'put', 'patch', 'delete', 'head', 'options'] as const)(
    'does not admit %s eligibility',
    async (method) => {
      const res = await request(app.getHttpServer())[method]('/api/eligibility').set(credentials());
      // Nest/Express may return automatic OPTIONS, but it must never execute eligibility.
      expect([403, 404]).toContain(res.status);
    },
  );
  it('keeps unknown routes and undeclared authenticated controllers closed', async () => {
    await request(app.getHttpServer()).get('/api/not-a-route').set(credentials()).expect(404);
    await request(app.getHttpServer()).get('/api/eligibility/').set(credentials()).expect(403);
    await request(app.getHttpServer())
      .get('/api/undeclared-eligibility-test')
      .set(credentials())
      .expect(403);
  });
  it('preserves only the intended public operational probes', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok', service: 'ai-service' });
    await request(app.getHttpServer())
      .get('/api/ready')
      .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
    await request(app.getHttpServer()).head('/api/health').expect(403);
  });
});
