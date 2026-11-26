import { HttpException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as http from 'http';
import { join } from 'path';
import { Script } from 'vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { createApplication } from '../main';
import { parseRuntimeEnv } from '../config/runtime-env';
import {
  AI_CLIENT_FACTORY,
  AiDatabaseService,
  createAiClient,
} from '../persistence/ai-database.service';
import { PrismaClient } from '../../prisma/generated/client';
import { RequestNonceStore } from '../persistence/request-nonce.store';
import {
  RequestIntegrityService,
  requireConsumedAiRequest,
  VerifiedAiRequest,
} from './request-integrity.service';
import { RequestVerificationKeys } from './verification-keys';

interface Gateway {
  parseAiSigningConfig(env: Record<string, unknown>): unknown;
  buildAiForwardingDescriptor(input: Record<string, unknown>): unknown;
  AiRequestIntegritySigner: new (config: unknown) => { seal(descriptor: unknown): unknown };
  openSignedAiRequest(
    signed: unknown,
    origin: string,
    response: (res: http.IncomingMessage) => void,
    failure: (error: Error) => void,
  ): { send(): void; cancel(): void };
}
// Compile the actual Gateway source in memory: no cross-workspace production dependency or stale dist fixture.
const source = readFileSync(
  join(__dirname, '../../../api-gateway/src/proxy/ai-request-integrity.ts'),
  'utf8',
);
const compiled = transpileModule(source, {
  compilerOptions: {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});
const gatewayModule: { exports: unknown } = { exports: {} };
const load = new Script(
  `(function(require,module,exports){${compiled.outputText}\n})`,
).runInThisContext() as (
  require: NodeRequire,
  module: { exports: unknown },
  exports: unknown,
) => void;
load(require, gatewayModule, gatewayModule.exports);
const gateway = gatewayModule.exports as Gateway;
const secret = 'local-test-jwt-only-not-production';
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function entry(n: number) {
  const bytes = Buffer.alloc(32, n);
  return { id: digest(bytes), key: bytes.toString('base64') };
}
const primary = entry(91),
  historical = entry(92);
const urlPlaceholder = 'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai';
const baseEnv = (extra: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_POLICY_VERSION: 'verification-test',
  JWT_SECRET: secret,
  AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
  AI_PERSISTENCE_ENABLED: 'true',
  DATABASE_URL: urlPlaceholder,
  AI_REQUEST_VERIFICATION_ENABLED: 'true',
  AI_REQUEST_VERIFICATION_KEYS: JSON.stringify([primary, historical]),
  ...extra,
});
const path = '/api/conversations/11111111-1111-4111-8111-111111111111/messages';
interface Wire {
  method: string;
  target: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}
interface Reply {
  status: number;
  body: string;
}
async function listen(server: http.Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No disposable listener');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: http.Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
function forward(
  origin: string,
  extra: Record<string, unknown> = {},
  signing = primary,
): Promise<Reply> {
  const token = jwt.sign({ sub: 'user-a', tenantId: 'tenant-a', sessionVersion: 1 }, secret, {
    expiresIn: '15m',
  });
  const permissions = '[]';
  const identityAssertion = jwt.sign(
    {
      user: {
        id: 'user-a',
        tenantId: 'tenant-a',
        role: 'EMPLOYEE',
        email: 'test@example.test',
        tenantSlug: 'tenant-a',
        tenantName: 'Tenant A',
        firstName: 'Test',
        moduleConfig: {},
        featureConfig: {},
      },
      tokenHash: digest(token),
      permissionsHash: digest(permissions),
    },
    secret,
    { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
  );
  const descriptor = gateway.buildAiForwardingDescriptor({
    method: 'POST',
    externalTarget: '/api/v1/ai' + path.slice(4),
    body: { content: 'private-body-canary 🌍' },
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': 'shared-business-key',
    },
    identityAssertion,
    permissions,
    permissionsSignature: 'a'.repeat(64),
    deadlineAtMs: Date.now() + 5000,
    ...extra,
  });
  const signer = new gateway.AiRequestIntegritySigner(
    gateway.parseAiSigningConfig({
      NODE_ENV: 'test',
      AI_REQUEST_SIGNING_ENABLED: 'true',
      AI_REQUEST_SIGNING_KEY_ID: signing.id,
      AI_REQUEST_SIGNING_KEY: signing.key,
    }),
  );
  return new Promise((resolve, reject) => {
    gateway
      .openSignedAiRequest(
        signer.seal(descriptor),
        origin,
        (response) => {
          let body = '';
          response.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          response.on('end', () => resolve({ status: response.statusCode!, body }));
        },
        reject,
      )
      .send();
  });
}
async function wire(extra: Record<string, unknown> = {}, signing = primary) {
  let captured!: Wire;
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      captured = {
        method: request.method!,
        target: request.url!,
        headers: request.headers,
        body: Buffer.concat(chunks),
      };
      response.end('fixture');
    });
  });
  const origin = await listen(server);
  try {
    await forward(origin, extra, signing);
    return captured;
  } finally {
    await close(server);
  }
}
function send(origin: string, value: Wire): Promise<Reply> {
  const url = new URL(origin);
  const headers: http.OutgoingHttpHeaders = {
    ...value.headers,
    host: url.host,
    'content-length': String(value.body.length),
  };
  for (const name of Object.keys(headers)) if (headers[name] === undefined) delete headers[name];
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        method: value.method,
        path: value.target,
        headers,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        response.on('end', () => resolve({ status: response.statusCode!, body }));
      },
    );
    request.on('error', reject);
    request.end(value.body);
  });
}
function resign(
  value: Wire,
  change: Record<string, unknown>,
  header: Record<string, unknown> = {},
  algorithm: jwt.Algorithm = 'HS256',
  signing = primary,
): Wire {
  const original = String(value.headers['x-ai-request-integrity']);
  const payload = jwt.decode(original) as jwt.JwtPayload;
  if (algorithm === 'HS256') {
    // Negative fixtures deliberately permit malformed claim types rejected by jwt.sign itself.
    const encodedHeader = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'workphelo.ai.request+jwt', kid: signing.id, ...header }),
    ).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify({ ...payload, ...change })).toString(
      'base64url',
    );
    const signingInput = encodedHeader + '.' + encodedPayload;
    const signature = createHmac('sha256', Buffer.from(signing.key, 'base64'))
      .update(signingInput)
      .digest('base64url');
    return {
      ...value,
      headers: { ...value.headers, 'x-ai-request-integrity': signingInput + '.' + signature },
    };
  }
  const proof = jwt.sign({ ...payload, ...change }, Buffer.from(signing.key, 'base64'), {
    algorithm,
    header: { alg: algorithm, typ: 'workphelo.ai.request+jwt', kid: signing.id, ...header },
  });
  return { ...value, headers: { ...value.headers, 'x-ai-request-integrity': proof } };
}
async function harness(
  databaseUrl?: string,
  extra: Record<string, string | undefined> = {},
  observe = true,
) {
  const original = process.env;
  process.env = baseEnv({ ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}), ...extra });
  const consume = jest.fn<Promise<void>, unknown[]>().mockResolvedValue(undefined);
  const logs: unknown[] = [];
  let app: INestApplication<http.Server>;
  try {
    if (databaseUrl)
      app = await createApplication({ ignoreEnvFile: true }, (value) => logs.push(value));
    else {
      const module = await Test.createTestingModule({
        imports: [AppModule.register({ ignoreEnvFile: true })],
      })
        .overrideProvider(AI_CLIENT_FACTORY)
        .useValue(() => ({ $connect: jest.fn(), $disconnect: jest.fn() }))
        .overrideProvider(RequestNonceStore)
        .useValue({ consume })
        .compile();
      app = module.createNestApplication<INestApplication<http.Server>>({
        bodyParser: false,
        logger: false,
      });
      configureApplication(app, (value) => logs.push(value), true);
    }
    const accepted: VerifiedAiRequest[] = [];
    if (observe)
      app.use((request: Request, response: Response, next: NextFunction) => {
        // Test-only observation, NOT an HTTP business handler. Always continue to unchanged default-deny routing.
        void app
          .get(RequestIntegrityService)
          .authenticateAndConsume(request)
          .then((context) => {
            accepted.push(context);
            next();
          })
          .catch((error: unknown) =>
            response
              .status(error instanceof HttpException ? error.getStatus() : 500)
              .json({ code: 'REQUEST_REJECTED' }),
          );
      });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('No disposable listener');
    return { app, origin: `http://127.0.0.1:${address.port}`, consume, accepted, logs };
  } finally {
    process.env = original;
  }
}

describe('AI request verification config and actual Gateway HTTP contract (nonce store mocked)', () => {
  let receiver: Awaited<ReturnType<typeof harness>>;
  beforeAll(async () => {
    receiver = await harness();
  });
  beforeEach(() => {
    receiver.consume.mockClear();
    receiver.accepted.length = 0;
    receiver.logs.length = 0;
  });
  afterAll(async () => {
    await receiver?.app.close();
  });
  it('accepts exact Gateway-forwarded bytes while conversation HTTP stays disabled', async () => {
    expect((await forward(receiver.origin)).status).toBe(503);
    expect(receiver.consume).toHaveBeenCalledTimes(1);
    expect(requireConsumedAiRequest(receiver.accepted[0])).toMatchObject({
      tenantId: 'tenant-a',
      ownerUserId: 'user-a',
    });
  });
  it.each([
    { v: 2 },
    { demoIntent: undefined },
    { demoIntent: 'false' },
    { demoIntent: 0 },
    { iss: 'other' },
    { aud: 'other' },
    { bodyLength: '1' },
    { bodyLength: 1 },
    { bodyLength: -1 },
    { jti: 'bad-nonce' },
    { requestId: 'not-a-uuid' },
    { deadlineAtMs: 0 },
    { deadlineAtMs: Date.now() + 20000 },
    { bodyHash: undefined },
    { iat: 'invalid' },
    { exp: 'invalid' },
    { iat: Math.floor(Date.now() / 1000) + 20, exp: Math.floor(Date.now() / 1000) + 25 },
    { iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 11 },
    { iat: Math.floor(Date.now() / 1000) - 20, exp: Math.floor(Date.now() / 1000) - 10 },
    { bodyHash: 'a'.repeat(64) },
    { pathHash: 'bad' },
    { method: 'DELETE' },
    { contentType: 'text/plain' },
    { unexpected: true },
  ])(
    'rejects malformed or substituted signed claims before nonce consumption: %p',
    async (change) => {
      expect((await send(receiver.origin, resign(await wire(), change))).status).toBe(401);
      expect(receiver.consume).not.toHaveBeenCalled();
    },
  );
  it('rejects authenticated demo-mode drift before consuming a nonce', async () => {
    expect((await forward(receiver.origin, { demoIntent: true })).status).toBe(503);
    expect(receiver.consume).not.toHaveBeenCalled();
  });
  it.each([
    { typ: 'JWT' },
    { kid: 'f'.repeat(64) },
    { crit: ['unknown'] },
    { jku: 'https://untrusted.invalid' },
  ])('rejects unsupported proof header %p', async (header) => {
    expect((await send(receiver.origin, resign(await wire(), {}, header))).status).toBe(401);
    expect(receiver.consume).not.toHaveBeenCalled();
  });
  it('rejects algorithm substitution, wrong key material and missing proof', async () => {
    const value = await wire();
    const wrongKey = resign(value, {}, { kid: primary.id }, 'HS256', historical);
    const absent = { ...value, headers: { ...value.headers, 'x-ai-request-integrity': undefined } };
    for (const changed of [resign(value, {}, {}, 'HS384'), wrongKey, absent])
      expect((await send(receiver.origin, changed)).status).toBe(401);
    expect(receiver.consume).not.toHaveBeenCalled();
  });
  it('rejects alg:none and duplicate JSON claim names even when the bytes have a valid HMAC', async () => {
    const value = await wire();
    const parts = String(value.headers['x-ai-request-integrity']).split('.');
    const unsigned =
      Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'workphelo.ai.request+jwt', kid: primary.id }),
      ).toString('base64url') +
      '.' +
      parts[1] +
      '.';
    expect(
      (
        await send(receiver.origin, {
          ...value,
          headers: { ...value.headers, 'x-ai-request-integrity': unsigned },
        })
      ).status,
    ).toBe(401);
    // A duplicate member is not Gateway's canonical JSON representation.
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    const duplicate = Buffer.from(payload.replace('{', '{"v":1,')).toString('base64url');
    const signingInput = parts[0] + '.' + duplicate;
    const signature = createHmac('sha256', Buffer.from(primary.key, 'base64'))
      .update(signingInput)
      .digest('base64url');
    expect(
      (
        await send(receiver.origin, {
          ...value,
          headers: { ...value.headers, 'x-ai-request-integrity': signingInput + '.' + signature },
        })
      ).status,
    ).toBe(401);
    expect(receiver.consume).not.toHaveBeenCalled();
  });
  it.each([
    'method',
    'path',
    'body',
    'idempotency',
    'credential',
    'identity',
    'content-type',
    'duplicate-proof',
    'duplicate-authorization',
    'cookie',
    'compressed',
    'multipart',
    'malformed-json',
    'encoded-path',
  ])('rejects actual HTTP mutation %s', async (kind) => {
    const value = await wire();
    const changed: Wire = { ...value, headers: { ...value.headers } };
    if (kind === 'method') changed.method = 'DELETE';
    if (kind === 'path') changed.target = value.target.replace('11111111', '22222222');
    if (kind === 'path') changed.headers['x-forwarded-path'] = value.target;
    if (kind === 'body') changed.body = Buffer.from('{ "content": "private-body-canary 🌍" }');
    if (kind === 'idempotency') changed.headers['idempotency-key'] = 'changed';
    if (kind === 'credential') changed.headers.authorization = 'Bearer other';
    if (kind === 'identity') changed.headers['x-gateway-auth-context'] = 'other';
    if (kind === 'content-type') changed.headers['content-type'] = 'application/json';
    if (kind === 'duplicate-proof')
      changed.headers['x-ai-request-integrity'] = [
        String(value.headers['x-ai-request-integrity']),
        String(value.headers['x-ai-request-integrity']),
      ];
    if (kind === 'duplicate-authorization')
      (changed.headers as Record<string, string | string[] | undefined>).authorization = [
        String(value.headers.authorization),
        String(value.headers.authorization),
      ];
    if (kind === 'cookie') changed.headers.cookie = 'access_token=untrusted';
    if (kind === 'compressed') changed.headers['content-encoding'] = 'gzip';
    if (kind === 'multipart') changed.headers['content-type'] = 'multipart/form-data; boundary=x';
    if (kind === 'malformed-json') changed.body = Buffer.from('{');
    if (kind === 'encoded-path')
      changed.target = value.target.replace('/conversations', '/%63onversations');
    expect((await send(receiver.origin, changed)).status).toBe(
      kind === 'malformed-json' ? 400 : ['content-type', 'multipart'].includes(kind) ? 415 : 401,
    );
    expect(receiver.consume).not.toHaveBeenCalled();
  });
  it('preserves exact raw query bytes and rejects reordered equivalent parameters', async () => {
    const value = await wire({
      method: 'GET',
      body: undefined,
      externalTarget: '/api/v1/ai/conversations?cursor=%41bc&limit=%32',
    });
    expect((await send(receiver.origin, value)).status).toBe(503);
    expect(
      (await send(receiver.origin, { ...value, target: '/api/conversations?limit=2&cursor=Abc' }))
        .status,
    ).toBe(401);
    expect(receiver.consume).toHaveBeenCalledTimes(1);
  });
  it('keeps proof/idempotency keys separate and requires existing JWT/context before nonce consumption', async () => {
    await forward(receiver.origin);
    await forward(receiver.origin);
    const calls = receiver.consume.mock.calls as unknown as [Buffer, number, number, number][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0].equals(calls[1][0])).toBe(false);
    const value = await wire();
    delete value.headers['idempotency-key'];
    expect((await send(receiver.origin, value)).status).toBe(401);
    expect(() => requireConsumedAiRequest({} as VerifiedAiRequest)).toThrow('Unauthorized');
  });
  it('does not disclose proofs, credentials or body content in logs or safe failures', async () => {
    const value = await wire();
    value.body = Buffer.from('{');
    const response = await send(receiver.origin, value);
    const output = JSON.stringify(receiver.logs) + response.body;
    for (const marker of [
      'private-body-canary',
      secret,
      primary.key,
      String(value.headers.authorization),
      String(value.headers['x-ai-request-integrity']),
    ])
      expect(output).not.toContain(marker);
  });
  it('supports current/historical verification keys and rejects retired IDs without trial selection', async () => {
    expect((await forward(receiver.origin, {}, historical)).status).toBe(503);
    const rotated = await harness(undefined, {
      AI_REQUEST_VERIFICATION_KEYS: JSON.stringify([historical]),
    });
    try {
      expect((await forward(rotated.origin)).status).toBe(401);
      expect((await forward(rotated.origin, {}, historical)).status).toBe(503);
    } finally {
      await rotated.app.close();
    }
  });
  it('leaves actual application conversation routing closed even with all verification dependencies enabled', async () => {
    const normal = await harness(undefined, {}, false);
    try {
      expect((await forward(normal.origin)).status).toBe(503);
      expect(normal.consume).not.toHaveBeenCalled();
    } finally {
      await normal.app.close();
    }
  });
  it('keeps eligibility and probes independent from request proofs and nonce-store runtime failure', async () => {
    const normal = await harness(undefined, {}, false);
    normal.consume.mockRejectedValue(new Error('private-nonce-store-outage'));
    try {
      const value = await wire();
      delete value.headers['x-ai-request-integrity'];
      delete value.headers['content-type'];
      delete value.headers['idempotency-key'];
      const eligible = await send(normal.origin, {
        ...value,
        method: 'GET',
        target: '/api/eligibility',
        body: Buffer.alloc(0),
      });
      expect(eligible.status).toBe(200);
      expect(JSON.parse(eligible.body)).toEqual({ eligible: true, inferenceAvailable: false });
      for (const target of ['/api/health', '/api/ready'])
        expect(
          (
            await send(normal.origin, {
              ...value,
              method: 'GET',
              target,
              headers: {},
              body: Buffer.alloc(0),
            })
          ).status,
        ).toBe(200);
      expect(normal.consume).not.toHaveBeenCalled();
    } finally {
      await normal.app.close();
    }
  });
  it('rejects an accepted context after its deadline and fails closed on missing nonce-table startup', async () => {
    await forward(receiver.origin);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 12000);
    try {
      expect(() => requireConsumedAiRequest(receiver.accepted[0])).toThrow('Gateway Timeout');
    } finally {
      clock.mockRestore();
    }
    const store = new RequestNonceStore(
      {
        run: () => Promise.reject(new Error('private-table-missing')),
      } as unknown as AiDatabaseService,
      new ConfigService({ AI_REQUEST_VERIFICATION_ENABLED: true, AI_PERSISTENCE_ENABLED: true }),
    );
    await expect(store.onModuleInit()).rejects.toThrow('Service Unavailable');
  });
  it.each([
    undefined,
    '[]',
    'invalid-private-key',
    JSON.stringify([primary, primary]),
    JSON.stringify([{ ...primary, key: Buffer.alloc(31).toString('base64') }]),
  ])('rejects missing/invalid verification keys %p', (keys) => {
    expect(() => parseRuntimeEnv(baseEnv({ AI_REQUEST_VERIFICATION_KEYS: keys }))).toThrow(
      'AI_REQUEST_VERIFICATION_KEYS',
    );
  });
  it('defaults off and rejects missing authentication/persistence or reused key configuration', () => {
    expect(
      parseRuntimeEnv({ NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'v1' })
        .AI_REQUEST_VERIFICATION_ENABLED,
    ).toBe(false);
    for (const extra of [
      { AI_AUTHENTICATED_ROUTES_ENABLED: 'false' },
      { AI_PERSISTENCE_ENABLED: 'false' },
      { JWT_SECRET: primary.key },
    ])
      expect(() => parseRuntimeEnv(baseEnv(extra))).toThrow(
        'Invalid or missing AI runtime configuration',
      );
    expect(() => new RequestVerificationKeys(new ConfigService({})).requireEnabled()).toThrow(
      'Service Unavailable',
    );
  });
  it('bounds nonce persistence by the earlier proof expiry or signed deadline', async () => {
    const transaction = jest.fn().mockResolvedValue(true);
    const store = new RequestNonceStore(
      { transaction } as unknown as AiDatabaseService,
      new ConfigService({ AI_REQUEST_VERIFICATION_ENABLED: true, AI_PERSISTENCE_ENABLED: true }),
    );
    const now = Date.now();
    await store.consume(randomBytes(32), now, now + 4000, now + 1000);
    expect(transaction).toHaveBeenNthCalledWith(1, expect.any(Function), now + 1000);
    await store.consume(randomBytes(32), now, now + 2000, now + 4000);
    expect(transaction).toHaveBeenNthCalledWith(2, expect.any(Function), now + 2000);
  });
});

const testUrl = process.env.AI_TEST_DATABASE_URL;
(testUrl ? describe : describe.skip)(
  'Atomic nonce replay protection on disposable PostgreSQL (real replicas)',
  () => {
    let first: Awaited<ReturnType<typeof harness>>, second: Awaited<ReturnType<typeof harness>>;
    let db: PrismaClient;
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/workphelo_ai_2b1' ||
        url.searchParams.get('schema') !== 'ai'
      )
        throw new Error('Only disposable AI PostgreSQL is allowed');
      first = await harness(testUrl);
      second = await harness(testUrl);
      db = createAiClient(testUrl!);
      await db.$connect();
    });
    beforeEach(async () => {
      // This table belongs only to the guarded disposable database; isolate replay fixtures across runs.
      await db.aiRequestNonce.deleteMany();
    });
    afterAll(async () => {
      await first?.app.close();
      await second?.app.close();
      await db?.$disconnect();
    });
    it('consumes once and rejects the same proof across separate AI application replicas', async () => {
      const value = await wire();
      const replies = await Promise.all(
        Array.from({ length: 8 }, (_, i) => send(i % 2 ? first.origin : second.origin, value)),
      );
      expect(replies.filter((r) => r.status === 503)).toHaveLength(1);
      expect(replies.filter((r) => r.status === 401)).toHaveLength(7);
    });
    it('allows fresh proof nonces with the same business key', async () => {
      const before = first.accepted.length;
      expect((await forward(first.origin)).status).toBe(503);
      expect((await forward(first.origin)).status).toBe(503);
      expect(first.accepted.length - before).toBe(2);
    });
    it('times out a blocked nonce insert within the signed execution budget', async () => {
      const key = randomBytes(32);
      let unlock!: () => void;
      let acquired!: () => void;
      const held = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const blocker = db.$transaction(async (tx) => {
        await tx.aiRequestNonce.create({
          data: { replayDigest: key, expiresAt: new Date(Date.now() + 60000) },
        });
        acquired();
        await held;
      });
      await ready;
      const started = Date.now();
      try {
        await expect(
          first.app.get(RequestNonceStore).consume(key, started, started + 4000, started + 600),
        ).rejects.toMatchObject({ status: 504 });
        expect(Date.now() - started).toBeLessThan(1200);
      } finally {
        unlock();
        await blocker;
      }
      expect(await db.aiRequestNonce.count({ where: { replayDigest: key } })).toBe(1);
    });
    it('keeps nonce consumption committed when a later business transaction rolls back', async () => {
      const value = await wire();
      expect((await send(first.origin, value)).status).toBe(503);
      const id = randomUUID();
      await expect(
        db.$transaction(async (tx) => {
          await tx.aiConversation.create({
            data: {
              id,
              tenantId: 'tenant-a',
              ownerUserId: 'user-a',
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          throw new Error('test-only rollback');
        }),
      ).rejects.toThrow('test-only rollback');
      expect(await db.aiConversation.findUnique({ where: { id } })).toBeNull();
      expect((await send(second.origin, value)).status).toBe(401);
    });
    it('keeps the nonce after response loss and requires a fresh proof for retry', async () => {
      const value = await wire();
      // Treat the first received response as lost at the client.
      await send(first.origin, value);
      expect((await send(second.origin, value)).status).toBe(401);
      expect((await forward(second.origin)).status).toBe(503);
    });
    it('fails closed during nonce-store outage without consuming the failed request', async () => {
      const value = await wire(),
        database = first.app.get(AiDatabaseService);
      await database.onModuleDestroy();
      try {
        expect((await send(first.origin, value)).status).toBe(503);
      } finally {
        await database.onModuleInit();
      }
      expect((await send(first.origin, value)).status).toBe(503);
    });
    it('retains accepted nonces beyond proof validity and purges only expired bounded batches', async () => {
      const value = await wire();
      await send(first.origin, value);
      const payload = jwt.decode(String(value.headers['x-ai-request-integrity'])) as jwt.JwtPayload;
      const key = createHash('sha256')
        .update(
          JSON.stringify([
            'workphelo.ai.request-nonce',
            1,
            'workphelo-gateway',
            'workphelo-ai-request',
            payload.jti,
          ]),
        )
        .digest();
      const stored = await db.aiRequestNonce.findUniqueOrThrow({ where: { replayDigest: key } });
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(
        Math.max(payload.exp! * 1000, Number(payload.deadlineAtMs)) + 60000,
      );
      const old = Array.from({ length: 4 }, () => randomBytes(32));
      await db.aiRequestNonce.createMany({
        data: old.map((replayDigest) => ({
          replayDigest,
          createdAt: new Date(Date.now() - 70000),
          expiresAt: new Date(Date.now() - 1000),
        })),
      });
      const store = first.app.get(RequestNonceStore);
      expect(await store.purgeExpired(1)).toBe(1);
      expect(
        (
          await Promise.all([
            store.purgeExpired(1),
            second.app.get(RequestNonceStore).purgeExpired(1),
          ])
        ).reduce((a, b) => a + b, 0),
      ).toBe(2);
      expect(await db.aiRequestNonce.count({ where: { replayDigest: { in: old } } })).toBe(1);
      await store.purgeExpired();
      expect(await db.aiRequestNonce.findUnique({ where: { replayDigest: key } })).not.toBeNull();
      expect((await send(first.origin, value)).status).toBe(401);
    });
    it('enforces minimal field bounds, expiry index and AI-only replay metadata', async () => {
      await expect(
        db.aiRequestNonce.create({
          data: { replayDigest: Buffer.alloc(1), expiresAt: new Date(Date.now() + 1000) },
        }),
      ).rejects.toThrow();
      await expect(
        db.aiRequestNonce.create({
          data: { replayDigest: randomBytes(32), expiresAt: new Date(Date.now() + 120000) },
        }),
      ).rejects.toThrow();
      const columns = await db.$queryRaw<
        { column_name: string }[]
      >`SELECT column_name FROM information_schema.columns WHERE table_schema='ai' AND table_name='AiRequestNonce' ORDER BY column_name`;
      expect(columns.map((c) => c.column_name)).toEqual([
        'createdAt',
        'expiresAt',
        'ownerUserId',
        'replayDigest',
        'tenantId',
      ]);
      const indexes = await db.$queryRaw<
        { indexname: string }[]
      >`SELECT indexname FROM pg_indexes WHERE schemaname='ai' AND tablename='AiRequestNonce'`;
      expect(indexes.map((i) => i.indexname)).toEqual(
        expect.arrayContaining(['AiRequestNonce_pkey', 'AiRequestNonce_expiry_idx']),
      );
    });
    it('works with restricted nonce privileges and grants no cross-service or DDL access', async () => {
      const role = 'ai_nonce_' + randomUUID().replace(/-/g, '');
      await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS unrelated_nonce_domain');
      await db.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS unrelated_nonce_domain.marker (id integer)',
      );
      await db.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD 'local-nonce-test-only'`);
      await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ai TO "${role}"`);
      await db.$executeRawUnsafe(`GRANT SELECT,INSERT,DELETE ON ai."AiRequestNonce" TO "${role}"`);
      const url = new URL(testUrl!);
      url.username = role;
      url.password = 'local-nonce-test-only';
      const client = createAiClient(url.toString());
      const database = new AiDatabaseService(
        new ConfigService({ AI_PERSISTENCE_ENABLED: true, DATABASE_URL: url.toString() }),
        createAiClient,
      );
      await database.onModuleInit();
      const store = new RequestNonceStore(
        database,
        new ConfigService({ AI_PERSISTENCE_ENABLED: true, AI_REQUEST_VERIFICATION_ENABLED: true }),
      );
      try {
        await store.onModuleInit();
        const now = Date.now();
        await store.consume(randomBytes(32), Math.floor(now / 1000) * 1000, now + 5000, now + 5000);
        await expect(client.aiConversation.count()).rejects.toThrow();
        await expect(
          client.$executeRawUnsafe('CREATE TABLE ai.forbidden_nonce_ddl (id integer)'),
        ).rejects.toThrow();
        await expect(
          client.$queryRawUnsafe('SELECT * FROM unrelated_nonce_domain.marker'),
        ).rejects.toThrow();
      } finally {
        await database.onModuleDestroy();
        await client.$disconnect();
      }
    });
  },
);
