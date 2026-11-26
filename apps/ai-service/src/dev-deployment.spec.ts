import 'reflect-metadata';
import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { createServer, Server } from 'http';
import { join } from 'path';
import { createHash } from 'crypto';
import cookieParser from 'cookie-parser';
import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { parseRuntimeEnv } from './config/runtime-env';
import { AI_CLIENT_FACTORY } from './persistence/ai-database.service';
import { INFERENCE_PROVIDER } from './inference/inference-provider';

// Jest loads actual Gateway source without making it part of AI's production rootDir.
const loadGateway = require;
const { ProxyController } = loadGateway('../../api-gateway/src/proxy/proxy.controller') as {
  ProxyController: Type<object>;
};
const { AiRateAdmission } = loadGateway('../../api-gateway/src/proxy/ai-rate-admission') as {
  AiRateAdmission: Type<object>;
};
const { aiConversationJsonBoundary } = loadGateway(
  '../../api-gateway/src/proxy/ai-conversation-body',
) as {
  aiConversationJsonBoundary: () => RequestHandler;
};

const root = join(__dirname, '../../..');
const script = readFileSync(join(root, '.github/scripts/deploy-dev.sh'), 'utf8');
const secret = 'synthetic-dev-eligibility-secret';
// This synthetic fixture is not DEV deployment configuration. The historical
// rollout deliberately has no AI container or upstream; retain protocol coverage
// without claiming that the restored workflow deploys or enables AI.
function isolatedEligibilityEnv(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    AI_SERVICE_PORT: '4011',
    AI_PROVIDER: 'mock',
    AI_POLICY_VERSION: 'isolated-eligibility-test',
    JWT_SECRET: secret,
    AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
    ...Object.fromEntries(
      [
        'AI_ENABLED',
        'AI_MOCK_ENABLED',
        'AI_INTERNAL_DEMO_ENABLED',
        'AI_PERSISTENCE_ENABLED',
        'AI_MESSAGE_ENCRYPTION_ENABLED',
        'AI_MESSAGE_OPERATIONS_ENABLED',
        'AI_REQUEST_VERIFICATION_ENABLED',
        'AI_CONVERSATION_HTTP_ENABLED',
        'AI_RESOURCE_SAFEGUARDS_ENABLED',
        'AI_RETENTION_CLEANUP_ENABLED',
        'AI_RETENTION_SCHEDULER_ENABLED',
      ].map((key) => [key, 'false']),
    ),
  };
}

describe('Historical DEV deployment restoration contract', () => {
  it('matches the three files at 64b410cd2b0a52c727bd15b490b1a9e7fc2da061 byte-for-byte', () => {
    const expected = {
      '.github/workflows/deploy-dev.yml':
        '773c7d3d33f43837c262bdf396f30bbe347cfb8328cdca6a97727bc7b88f70ac',
      '.github/scripts/deploy-dev.sh':
        'a938c4a36251148dc72f73315c7ec9b632025d23df3f86fd71c956d5446f65fa',
      'infrastructure/docker-compose.dev.yml':
        '2b80ffb0815397b3e20771bc179e411edc0ff1a3022e889ddfc96a617185acf8',
    };
    for (const [path, digest] of Object.entries(expected)) {
      expect(
        createHash('sha256')
          .update(readFileSync(join(root, path)))
          .digest('hex'),
      ).toBe(digest);
    }
  });
  it('restores original cancellation, image selection, migrations and seeds without planner dependencies', () => {
    const workflow = readFileSync(join(root, '.github/workflows/deploy-dev.yml'), 'utf8');
    const compose = readFileSync(join(root, 'infrastructure/docker-compose.dev.yml'), 'utf8');
    expect(workflow).toContain('cancel-in-progress: true');
    expect(workflow).toContain('changed: ${{ steps.filter.outputs.changes }}');
    expect(script).toContain('resolve_image_ref "$COMPOSE_ENV_FILE"');
    for (const value of [
      'dev-deployment-plan',
      'DEV_DATABASE_OPERATIONS_APPROVED_SHA',
      'DEV_DEPLOYMENT_BASELINE_SHA',
      '.dev-deploy/',
      'flock -n',
    ]) {
      expect(workflow + script).not.toContain(value);
    }
    expect(script.match(/npx prisma@5\.22\.0 migrate deploy/g)).toHaveLength(8);
    expect(script.match(/dist\/prisma\/seed\.js/g)).toHaveLength(2);
    expect(workflow + script).not.toContain('AI_SERVICE_URL=');
    expect(compose).not.toContain('\n  ai-service:');
  });
  it('keeps the isolated eligibility fixture DB-free with every execution flag disabled', () => {
    const env = isolatedEligibilityEnv();
    const config = parseRuntimeEnv(env);
    expect(config.NODE_ENV).toBe('production');
    expect(config.AI_AUTHENTICATED_ROUTES_ENABLED).toBe(true);
    expect(config.AI_SERVICE_PORT).toBe(4011);
    for (const [key, value] of Object.entries(config))
      if (key.endsWith('_ENABLED') && key !== 'AI_AUTHENTICATED_ROUTES_ENABLED')
        expect(value).toBe(false);
    for (const key of [
      'DATABASE_URL',
      'RABBITMQ_URL',
      'AI_ADMISSION_REDIS_URL',
      'AI_MESSAGE_ENCRYPTION_KEYS',
      'AI_FINGERPRINT_KEYS',
      'AI_REQUEST_VERIFICATION_KEYS',
    ])
      expect(env[key]).toBeUndefined();
  });
});

describe('Isolated Gateway -> AI eligibility protocol (not deployed by historical DEV rollout)', () => {
  const original = process.env;
  let ai: INestApplication<Server>, gateway: INestApplication<Server>, auth: Server;
  let allowed = true;
  const database = jest.fn(() => {
    throw new Error('Database forbidden');
  });
  const infer = jest.fn(() => {
    throw new Error('Inference forbidden');
  });
  const admit = jest.fn(() => {
    throw new Error('Redis admission forbidden');
  });
  const token = (claims: Record<string, unknown> = {}) =>
    jwt.sign(
      {
        sub: 'synthetic-user',
        tenantId: 'synthetic-tenant',
        ...claims,
      },
      secret,
      { expiresIn: 60 },
    );

  beforeAll(async () => {
    process.env = isolatedEligibilityEnv();
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
    })
      .overrideProvider(AI_CLIENT_FACTORY)
      .useValue(database)
      .overrideProvider(INFERENCE_PROVIDER)
      .useValue({ generateText: infer })
      .compile();
    ai = module.createNestApplication({ logger: false, bodyParser: false });
    configureApplication(ai, () => undefined);
    await ai.listen(0, '127.0.0.1');
    auth = createServer((_req, res) => {
      if (!allowed) {
        res.writeHead(401).end();
        return;
      }
      // Auth current-state is a controlled stub, not a real login or shared DB.
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          user: {
            id: 'synthetic-user',
            tenantId: 'synthetic-tenant',
            role: 'EMPLOYEE',
            email: '',
            tenantSlug: 'synthetic',
            tenantName: 'Synthetic',
            firstName: 'Test',
            moduleConfig: {},
            featureConfig: {},
          },
          permissions: [],
        }),
      );
    });
    await new Promise<void>((resolve) => auth.listen(0, '127.0.0.1', resolve));
    const address = auth.address();
    if (!address || typeof address === 'string') throw Error('No Auth fixture port');
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${address.port}`;
    process.env.AI_SERVICE_URL = await ai.getUrl();
    process.env.AI_REQUEST_SIGNING_ENABLED = 'false';
    const gw = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [{ provide: AiRateAdmission, useValue: { admit } }],
    }).compile();
    gateway = gw.createNestApplication({ logger: false, bodyParser: false });
    gateway.use(cookieParser());
    gateway.use(aiConversationJsonBoundary());
    await gateway.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await gateway?.close();
    await ai?.close();
    if (auth) await new Promise<void>((resolve) => auth.close(() => resolve()));
    process.env = original;
    expect(database).not.toHaveBeenCalled();
    expect(infer).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });
  it('starts healthy/ready with real inference unavailable and no persistence', async () => {
    await request(ai.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok', service: 'ai-service' });
    await request(ai.getHttpServer())
      .get('/api/ready')
      .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
  });
  it.each(['Bearer', 'cookie'])(
    'serves eligibility via %s with a Gateway-generated bound assertion',
    async (mode) => {
      const call = request(gateway.getHttpServer()).get('/api/v1/ai/eligibility');
      if (mode === 'cookie') call.set('Cookie', `access_token=${token()}`);
      else call.set('Authorization', `Bearer ${token()}`);
      await call.expect(200, { eligible: true, inferenceAvailable: false });
    },
  );
  it('rejects unauthenticated requests and spoofed direct-service identity', async () => {
    await request(gateway.getHttpServer()).get('/api/v1/ai/eligibility').expect(401);
    await request(ai.getHttpServer())
      .get('/api/eligibility')
      .set('Authorization', `Bearer ${token()}`)
      .set('x-gateway-auth-context', 'forged')
      .expect(401);
  });
  it('fails closed when Auth rejects the current session', async () => {
    allowed = false;
    try {
      await request(gateway.getHttpServer())
        .get('/api/v1/ai/eligibility')
        .set('Authorization', `Bearer ${token()}`)
        .expect(401);
    } finally {
      allowed = true;
    }
  });
  it('rejects careers-scoped sessions', async () => {
    await request(gateway.getHttpServer())
      .get('/api/v1/ai/eligibility')
      .set('Authorization', `Bearer ${token({ scope: 'careers' })}`)
      .expect(403);
  });
  it('keeps conversations, inference and internal public probes unavailable', async () => {
    await request(gateway.getHttpServer()).post('/api/v1/ai/conversations').send({}).expect(503);
    await request(ai.getHttpServer()).get('/api/conversations').expect(503);
    await request(ai.getHttpServer()).post('/api/inference').send({}).expect(404);
    await request(gateway.getHttpServer())
      .get('/api/v1/ai/health')
      .set('Authorization', `Bearer ${token()}`)
      .expect(404);
  });
});
