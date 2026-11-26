import 'reflect-metadata';
import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { createServer, Server } from 'http';
import { join } from 'path';
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
function deployedAiEnv(): Record<string, string> {
  const block = script
    .split('write_env_file "${DEPLOY_PATH}/apps/ai-service/.env.dev"')[1]
    .split('\n\n')[0];
  return Object.fromEntries(
    [...block.matchAll(/"([A-Z_]+)=([^"\n]*)"/g)].map((match) => [
      match[1],
      match[2].replace('${JWT_SECRET}', secret),
    ]),
  );
}

describe('DEV eligibility-only deployment contract', () => {
  it('validates the exact generated startup configuration without DB, Redis or execution keys', () => {
    const env = deployedAiEnv();
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
  it('never adds AI to migration/seed commands and requires an immutable image', () => {
    expect(script).not.toMatch(
      /docker_compose(?:_exec)?\s+(?:run\s+--rm\s+)?ai-service[^\n]*(?:prisma|migrate|seed|reconcile)/,
    );
    expect(script).toContain('is_sha_tagged_workphelo_ref "$AI_SERVICE_IMAGE"');
    expect(script).toContain('AI_SERVICE_URL=http://ai-service:4011');
    expect(script).toContain('AI_REQUEST_SIGNING_ENABLED=false');
    const compose = readFileSync(join(root, 'infrastructure/docker-compose.dev.yml'), 'utf8');
    const ai = compose.split('\n  ai-service:\n')[1].split('\n  api-gateway:')[0];
    expect(ai).not.toContain('ports:');
    expect(ai).not.toContain('depends_on:');
    expect(ai).toContain('AI_SERVICE_IMAGE');
    expect(ai).toContain('/api/ready');
    const workflow = readFileSync(join(root, '.github/workflows/deploy-dev.yml'), 'utf8');
    expect(workflow).toContain('ai-service: ${{ steps.filter.outputs.ai-service }}');
    expect(workflow).toContain('dockerfile: apps/ai-service/Dockerfile');
    expect(workflow).toContain("- 'apps/ai-service/**'");
  });
});

describe('Actual Gateway -> AI with DEV eligibility-only configuration', () => {
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
    process.env = deployedAiEnv();
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
