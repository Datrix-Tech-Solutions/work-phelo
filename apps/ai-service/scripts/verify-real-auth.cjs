// Local-only full Auth AppModule integration. No env files or external messaging are used.
const assert = require('node:assert/strict');
const { randomUUID, createHash, createHmac } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const root = resolve(__dirname, '../../..');
const input = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert(
  ['127.0.0.1', 'localhost'].includes(input.hostname) &&
    input.pathname === '/workphelo_ai_2b1' &&
    input.searchParams.get('schema') === 'ai',
  'Only the disposable AI/Auth database is allowed',
);
const authUrl = new URL(input);
authUrl.searchParams.set('schema', 'w_auth');
const originalEnv = process.env,
  cwd = process.cwd(),
  empty = mkdtempSync(join(tmpdir(), 'workphelo-auth-isolated-'));
const secret = 'real-auth-local-fixture-only';
process.chdir(empty);
process.env = {
  PATH: originalEnv.PATH,
  NODE_ENV: 'test',
  DATABASE_URL: authUrl.toString(),
  JWT_SECRET: secret,
  RABBITMQ_URL: 'amqp://fixture:fixture@127.0.0.1:1/unreachable',
  GOOGLE_CLIENT_ID: 'fixture',
  GOOGLE_CLIENT_SECRET: 'fixture',
  GOOGLE_CALLBACK_URL: 'http://127.0.0.1/callback',
  MICROSOFT_CLIENT_ID: 'fixture',
  MICROSOFT_CLIENT_SECRET: 'fixture',
  MICROSOFT_CALLBACK_URL: 'http://127.0.0.1/callback',
  FRONTEND_URL: 'http://localhost:3000',
  CAREERS_URL: 'http://localhost:3000',
};
require(resolve(root, 'node_modules/ts-node')).register({
  transpileOnly: true,
  project: resolve(root, 'apps/auth-service/tsconfig.json'),
});
require(resolve(root, 'node_modules/reflect-metadata'));
const { Test } = require(resolve(root, 'node_modules/@nestjs/testing'));
const { Module } = require(resolve(root, 'node_modules/@nestjs/common'));
const { NestFactory } = require(resolve(root, 'node_modules/@nestjs/core'));
const cookieParser = require(resolve(root, 'node_modules/cookie-parser'));
const express = require(resolve(root, 'node_modules/express'));
const jwt = require(resolve(root, 'node_modules/jsonwebtoken'));
let auth, ai, gateway, db, admissionRedis;
(async () => {
  const { AppModule } = require(resolve(root, 'apps/auth-service/src/app.module.ts'));
  const { PrismaService } = require(
    resolve(root, 'apps/auth-service/src/prisma/prisma.service.ts'),
  );
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider('NOTIFICATION_SERVICE')
    .useValue({
      send() {
        throw new Error('Messaging not authorized in this test');
      },
      emit() {
        throw new Error('Messaging not authorized in this test');
      },
      close() {},
    })
    .overrideProvider('HR_SERVICE')
    .useValue({
      send() {
        throw new Error('Messaging not authorized in this test');
      },
      emit() {
        throw new Error('Messaging not authorized in this test');
      },
      close() {},
    })
    .compile();
  auth = module.createNestApplication({ logger: false });
  auth.use(cookieParser());
  await auth.listen(0, '127.0.0.1');
  db = auth.get(PrismaService);
  const [database] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(database.name, 'workphelo_ai_2b1');
  const tenant = await db.tenant.create({
    data: {
      name: 'Local integration fixture',
      slug: randomUUID(),
      email: randomUUID() + '@example.test',
      status: 'ACTIVE',
    },
  });
  const otherTenant = await db.tenant.create({
    data: {
      name: 'Local other fixture',
      slug: randomUUID(),
      email: randomUUID() + '@example.test',
      status: 'ACTIVE',
    },
  });
  const user = await db.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Local',
      lastName: 'Fixture',
      email: randomUUID() + '@example.test',
      status: 'ACTIVE',
      role: 'EMPLOYEE',
    },
  });
  const key = (n) => {
    const bytes = Buffer.alloc(32, n);
    return { id: createHash('sha256').update(bytes).digest('hex'), key: bytes.toString('base64') };
  };
  const enc = key(101),
    fp = key(102),
    signing = key(103);
  Object.assign(process.env, {
    DATABASE_URL: input.toString(),
    AI_PROVIDER: 'mock',
    AI_POLICY_VERSION: 'real-auth-test',
    AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
    AI_PERSISTENCE_ENABLED: 'true',
    AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: enc.id,
    AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([enc]),
    AI_MESSAGE_OPERATIONS_ENABLED: 'true',
    AI_FINGERPRINT_ACTIVE_KEY_ID: fp.id,
    AI_FINGERPRINT_KEYS: JSON.stringify([fp]),
    AI_REQUEST_VERIFICATION_ENABLED: 'true',
    AI_REQUEST_VERIFICATION_KEYS: JSON.stringify([signing]),
    AI_CONVERSATION_HTTP_ENABLED: 'true',
    AI_RESOURCE_SAFEGUARDS_ENABLED: 'true',
    AI_REQUEST_SIGNING_ENABLED: 'true',
    AI_REQUEST_SIGNING_KEY: signing.key,
    AI_REQUEST_SIGNING_KEY_ID: signing.id,
    AUTH_SERVICE_URL: await auth.getUrl(),
  });
  const redisUrl = new URL(originalEnv.AI_TEST_ADMISSION_REDIS_URL || 'http://invalid');
  assert(
    ['127.0.0.1', 'localhost'].includes(redisUrl.hostname) && redisUrl.port === '17991',
    'Only the dedicated disposable admission Redis is allowed',
  );
  const Redis = require('ioredis');
  admissionRedis = new Redis(redisUrl.toString());
  await admissionRedis.flushdb();
  const runId = (await admissionRedis.info('server')).match(/run_id:([^\r\n]+)/)[1];
  const admissionTag = createHmac('sha256', Buffer.alloc(32, 96))
    .update('workphelo.ai.admission.v1')
    .digest('hex');
  await admissionRedis.set('ai:admission:v1:epoch', `${runId}:${admissionTag}`);
  process.env.AI_ADMISSION_REDIS_URL = redisUrl.toString();
  process.env.AI_ADMISSION_KEY_HMAC_SECRET = Buffer.alloc(32, 96).toString('base64');
  ai = await require(resolve(root, 'apps/ai-service/dist/main')).createApplication(
    { ignoreEnvFile: true },
    () => undefined,
  );
  await ai.listen(0, '127.0.0.1');
  process.env.AI_SERVICE_URL = await ai.getUrl();
  const { ProxyController } = require(
    resolve(root, 'apps/api-gateway/dist/proxy/proxy.controller'),
  );
  const { AiRateAdmission } = require(
    resolve(root, 'apps/api-gateway/dist/proxy/ai-rate-admission'),
  );
  const { aiConversationJsonBoundary } = require(
    resolve(root, 'apps/api-gateway/dist/proxy/ai-conversation-body'),
  );
  class Gateway {}
  Module({ controllers: [ProxyController], providers: [AiRateAdmission] })(Gateway);
  gateway = await NestFactory.create(Gateway, { bodyParser: false, logger: false });
  gateway.use(cookieParser());
  gateway.use(aiConversationJsonBoundary());
  gateway.use(express.json());
  await gateway.listen(0, '127.0.0.1');
  const base = await gateway.getUrl();
  let count = 0;
  const token = (extra = {}) =>
    jwt.sign({ sub: user.id, tenantId: tenant.id, sessionVersion: 0, ...extra }, secret, {
      expiresIn: '15m',
    });
  async function expectStatus(name, status, credential = token()) {
    await new Promise((r) => setTimeout(r, 130));
    const reply = await fetch(base + '/api/v1/ai/conversations', {
      headers: { Authorization: 'Bearer ' + credential },
    });
    assert.equal(reply.status, status, name);
    count++;
  }
  await expectStatus('active user and tenant', 200);
  async function operation(method, path, body, status) {
    await new Promise((r) => setTimeout(r, 130));
    const reply = await fetch(base + '/api/v1/ai/conversations' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token(),
        ...(body !== undefined
          ? {
              'Content-Type': 'application/json',
              'Idempotency-Key': randomUUID(),
            }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(reply.status, status, 'real Auth conversation ' + method);
    count++;
    return status === 204 ? undefined : reply.json();
  }
  const created = await operation('POST', '', {}, 201);
  const content = 'What can this demo do?';
  await operation('POST', '/' + created.id + '/messages', { content }, 201);
  const detail = await operation('GET', '/' + created.id, undefined, 200);
  assert.equal(detail.messages.items[0].content, content);
  await operation('DELETE', '/' + created.id, undefined, 204);
  await operation('GET', '/' + created.id, undefined, 404);
  for (const status of ['INACTIVE', 'SUSPENDED']) {
    await db.user.update({ where: { id: user.id }, data: { status } });
    await expectStatus('user ' + status, 401);
  }
  await db.user.update({
    where: { id: user.id },
    data: { status: 'ACTIVE', accessSuspendedAt: new Date() },
  });
  await expectStatus('explicit access suspension', 401);
  await db.user.update({
    where: { id: user.id },
    data: { accessSuspendedAt: null, sessionVersion: 1 },
  });
  await expectStatus('revoked/session-version mismatch', 401);
  await expectStatus('fresh matching session version', 200, token({ sessionVersion: 1 }));
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: 0 } });
  for (const status of ['PENDING', 'SUSPENDED', 'CANCELLED']) {
    await db.tenant.update({ where: { id: tenant.id }, data: { status } });
    await expectStatus('tenant ' + status, 401);
  }
  await db.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE' } });
  await db.user.update({ where: { id: user.id }, data: { tenantId: otherTenant.id } });
  await expectStatus('removed/reassigned tenant membership', 401);
  await db.user.update({ where: { id: user.id }, data: { tenantId: tenant.id } });
  await expectStatus('cross-tenant JWT binding', 401, token({ tenantId: otherTenant.id }));
  await expectStatus('careers scope', 403, token({ scope: 'careers' }));
  await expectStatus('unsupported token type', 403, token({ type: 'refresh' }));
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('LOCK TABLE w_auth."User" IN ACCESS EXCLUSIVE MODE');
      const started = Date.now();
      await expectStatus('Auth database stalled beyond shared deadline', 504);
      assert(Date.now() - started < 6500, 'Auth lookup exceeded bounded request budget');
    },
    { timeout: 10000 },
  );
  await db.user.delete({ where: { id: user.id } });
  await expectStatus('removed current identity', 401);
  await auth.close();
  auth = undefined;
  await expectStatus('Auth outage', 503);
  assert.equal((await fetch((await ai.getUrl()) + '/api/health')).status, 200);
  console.log(
    'Real Auth AppModule + real Gateway + real AI + disposable PostgreSQL PASS: ' +
      count +
      ' scenarios; only outbound messaging clients replaced with rejecting doubles',
  );
})()
  .catch((error) => {
    console.error(
      'Real Auth integration FAILED: ' +
        (error?.constructor?.name || 'unknown') +
        (error?.code ? ' code=' + error.code : ''),
    );
    if (error?.code === 'MODULE_NOT_FOUND') console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await gateway?.close();
    await ai?.close();
    await auth?.close();
    if (admissionRedis) await admissionRedis.quit();
    process.env = originalEnv;
    process.chdir(cwd);
    rmSync(empty, { recursive: true, force: true });
  });
