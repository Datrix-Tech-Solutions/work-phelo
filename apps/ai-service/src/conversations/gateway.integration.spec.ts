import 'reflect-metadata';
import { afterCapacity } from './capacity-test.fixture';
import {
  INestApplication,
  ServiceUnavailableException,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import * as http from 'http';
import { join, resolve } from 'path';
import { Script } from 'vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { parseRuntimeEnv } from '../config/runtime-env';
import {
  AI_CLIENT_FACTORY,
  AiDatabaseService,
  createAiClient,
} from '../persistence/ai-database.service';
import { RequestNonceStore } from '../persistence/request-nonce.store';
import { AuthorizedConversationOperations } from '../security/conversation-authorization.service';

// Load actual Gateway TS recursively in memory, not stale dist or a cross-workspace production dependency.
const cache = new Map<string, { exports: unknown }>();
const loadExternal = require;
function loadGateway(path: string): unknown {
  const filename = existsSync(path + '.ts') ? path + '.ts' : path;
  const previous = cache.get(filename);
  if (previous) return previous.exports;
  const module = { exports: {} as unknown };
  cache.set(filename, module);
  const compiled = transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });
  const evaluate = new Script(
    `(function(require,module,exports,process){${compiled.outputText}\n})`,
  ).runInThisContext() as (
    r: (name: string) => unknown,
    m: { exports: unknown },
    e: unknown,
    p: NodeJS.Process,
  ) => void;
  evaluate(
    (name) =>
      name.startsWith('.')
        ? loadGateway(resolve(filename, '..', name))
        : (loadExternal(name) as unknown),
    module,
    module.exports,
    process,
  );
  return module.exports;
}
const sourceRoot = join(__dirname, '../../../api-gateway/src');
const { ProxyController } = loadGateway(join(sourceRoot, 'proxy/proxy.controller')) as {
  ProxyController: Type<object>;
};
const { AiRateAdmission, AiAdmissionError } = loadGateway(
  join(sourceRoot, 'proxy/ai-rate-admission'),
) as {
  AiRateAdmission: Type<object>;
  AiAdmissionError: new (status: 429 | 503, retryAfter?: number) => Error;
};
const { aiConversationJsonBoundary } = loadGateway(
  join(sourceRoot, 'proxy/ai-conversation-body'),
) as { aiConversationJsonBoundary: () => ReturnType<typeof json> };
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const entry = (n: number) => {
  const bytes = Buffer.alloc(32, n);
  return { id: hash(bytes), key: bytes.toString('base64') };
};
const encryption = entry(71),
  fingerprint = entry(72),
  signing = entry(73);
const secret = 'gateway-integration-fixture-jwt-only';
const id = 'abcdef01-1111-4111-8111-111111111111';
const external = '/api/v1/ai/conversations';
interface Wire {
  method: string;
  target: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}
async function listen(server: http.Server) {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback listener');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: http.Server) {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
function raw(origin: string, wire: Wire): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(origin),
      headers = { ...wire.headers };
    delete headers.host;
    delete headers.connection;
    const call = http.request(
      { hostname: url.hostname, port: url.port, method: wire.method, path: wire.target, headers },
      (response) => {
        let body = '';
        response.on('data', (chunk: Buffer) => (body += chunk.toString()));
        response.on('end', () => resolve({ status: response.statusCode!, body }));
      },
    );
    call.on('error', reject);
    call.end(wire.body);
  });
}
async function harness(databaseUrl?: string) {
  const original = process.env;
  const state = {
    denied: false,
    authDelay: 0,
    relayDelay: 0,
    malicious: false,
    forcedReply: undefined as { status: number; retry?: string; code?: string } | undefined,
    admissionStatus: undefined as 429 | 503 | undefined,
    admissionCalls: [] as string[][],
    duplicate: 0,
    duplicateStatuses: [] as number[],
    dropResponse: false,
    mutate: undefined as ((wire: Wire) => Wire) | undefined,
  };
  let authCalls = 0;
  const auth = http.createServer((req, res) => {
    authCalls++;
    const reply = () => {
      if (res.destroyed) return;
      if (state.denied) {
        res.writeHead(401).end();
        return;
      }
      const token = req.headers.cookie?.slice('access_token='.length) ?? '';
      const claims = jwt.verify(token, secret) as jwt.JwtPayload;
      // Explicit Auth /me stub: active/session state is controlled here, not a real Auth database.
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          user: {
            id: claims.sub,
            tenantId: claims.tenantId as unknown,
            role: 'EMPLOYEE',
            email: '',
            tenantSlug: 'fixture',
            tenantName: 'Fixture',
            firstName: 'Fixture',
            moduleConfig: {},
            featureConfig: {},
          },
          permissions: [],
        }),
      );
    };
    if (state.authDelay) setTimeout(reply, state.authDelay).unref();
    else reply();
  });
  const authOrigin = await listen(auth);
  const base = {
    NODE_ENV: 'test',
    AI_PROVIDER: 'mock',
    AI_POLICY_VERSION: 'full-http-test',
    JWT_SECRET: secret,
    AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
    AI_PERSISTENCE_ENABLED: 'true',
    DATABASE_URL:
      databaseUrl ?? 'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai',
    AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
    AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([encryption]),
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: encryption.id,
    AI_MESSAGE_OPERATIONS_ENABLED: 'true',
    AI_FINGERPRINT_KEYS: JSON.stringify([fingerprint]),
    AI_FINGERPRINT_ACTIVE_KEY_ID: fingerprint.id,
    AI_REQUEST_VERIFICATION_ENABLED: 'true',
    AI_REQUEST_VERIFICATION_KEYS: JSON.stringify([signing]),
    AI_CONVERSATION_HTTP_ENABLED: 'true',
    AI_RESOURCE_SAFEGUARDS_ENABLED: 'true',
    AI_REQUEST_SIGNING_ENABLED: 'true',
    AI_REQUEST_SIGNING_KEY: signing.key,
    AI_REQUEST_SIGNING_KEY_ID: signing.id,
    ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:4000',
    AUTH_SERVICE_URL: authOrigin,
  };
  process.env = { ...base };
  const values: Record<string, unknown> = { ...parseRuntimeEnv(process.env) },
    spent = new Set<string>();
  const consume = jest.fn((digest: Buffer) => {
    const key = digest.toString('hex');
    if (spent.has(key)) return Promise.reject(new UnauthorizedException());
    spent.add(key);
    return Promise.resolve();
  });
  const now = new Date(),
    expiresAt = new Date(now.getTime() + 720 * 3600000);
  const metadata = { id, createdAt: now, updatedAt: now, expiresAt };
  const message = { id, conversationId: id, sequence: 1, role: 'USER', createdAt: now };
  let builder = Test.createTestingModule({ imports: [AppModule.register({ ignoreEnvFile: true })] })
    .overrideProvider(ConfigService)
    .useValue({
      get: (name: string) => values[name],
      getOrThrow: (name: string) => values[name],
      set: (name: string, value: unknown) => {
        values[name] = value;
      },
    });
  if (!databaseUrl)
    builder = builder
      .overrideProvider(AI_CLIENT_FACTORY)
      .useValue(() => ({ $connect: jest.fn(), $disconnect: jest.fn() }))
      .overrideProvider(RequestNonceStore)
      .useValue({ consume })
      .overrideProvider(AuthorizedConversationOperations)
      .useValue({
        createIdempotent: () => ({ id, createdAt: now, expiresAt }),
        listPage: () => ({ items: [metadata], nextCursor: null }),
        detail: () => ({ conversation: metadata, messages: { items: [], nextCursor: null } }),
        append: () => message,
        delete: () => undefined,
      });
  const module = await builder.compile();
  const ai = module.createNestApplication<INestApplication<http.Server>>({
    bodyParser: false,
    logger: false,
  });
  const logs: unknown[] = [];
  configureApplication(ai, (entry) => logs.push(entry), true);
  await ai.listen(0, '127.0.0.1');
  const aiOrigin = await ai.getUrl();
  const captured: Wire[] = [];
  const relay = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const original: Wire = {
        method: req.method!,
        target: req.url!,
        headers: { ...req.headers },
        body: Buffer.concat(chunks),
      };
      captured.push(original);
      if (state.forcedReply) {
        if (state.forcedReply.retry) res.setHeader('Retry-After', state.forcedReply.retry);
        res.setHeader('Set-Cookie', 'private-upstream-cookie');
        res
          .writeHead(state.forcedReply.status)
          .end(JSON.stringify({ code: state.forcedReply.code, stack: 'private-canary' }));
        return;
      }
      if (state.duplicate) {
        void Promise.all(Array.from({ length: state.duplicate }, () => raw(aiOrigin, original)))
          .then((replies) => {
            state.duplicateStatuses = replies.map((reply) => reply.status);
            const winner = replies.find((reply) => reply.status < 400) ?? replies[0];
            res.writeHead(winner.status, { 'Content-Type': 'application/json' }).end(winner.body);
          })
          .catch(() => res.writeHead(503).end());
        return;
      }
      if (state.malicious) {
        res.setHeader('Set-Cookie', 'private-upstream-cookie');
        res.writeHead(500).end('{"stack":"private-upstream-stack"}');
        return;
      }
      const forward = () => {
        const value = state.mutate ? state.mutate(original) : original,
          url = new URL(aiOrigin);
        const headers = { ...value.headers };
        delete headers.host;
        delete headers.connection;
        const call = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            method: value.method,
            path: value.target,
            headers,
          },
          (reply) => {
            if (state.dropResponse) {
              reply.resume();
              return;
            }
            res.writeHead(reply.statusCode!, reply.headers);
            reply.pipe(res);
          },
        );
        call.on('error', () => {
          if (!res.destroyed) res.writeHead(503).end();
        });
        call.end(value.body);
      };
      if (state.relayDelay) setTimeout(forward, state.relayDelay).unref();
      else forward();
    });
  });
  const relayOrigin = await listen(relay);
  process.env.AI_SERVICE_URL = relayOrigin;
  const gatewayModule = await Test.createTestingModule({
    controllers: [ProxyController],
    // This existing harness isolates proof/transport behavior. Shared Redis is
    // exercised independently against a disposable server by admission tests.
    providers: [
      {
        provide: AiRateAdmission,
        useValue: {
          admit: (tenantId: string, userId: string, method: string) => {
            state.admissionCalls.push([tenantId, userId, method]);
            if (state.admissionStatus) throw new AiAdmissionError(state.admissionStatus, 6);
            return Promise.resolve();
          },
        },
      },
    ],
  }).compile();
  const gateway = gatewayModule.createNestApplication<INestApplication<http.Server>>({
    bodyParser: false,
    logger: false,
  });
  gateway.use(cookieParser());
  gateway.use(aiConversationJsonBoundary());
  gateway.use(json());
  await gateway.listen(0, '127.0.0.1');
  const gatewayOrigin = await gateway.getUrl();
  const token = (
    user = 'integration-user',
    tenant = 'integration-tenant',
    extra: Record<string, unknown> = {},
  ) =>
    jwt.sign({ sub: user, tenantId: tenant, sessionVersion: 1, ...extra }, secret, {
      expiresIn: '15m',
    });
  return {
    ai,
    gateway,
    aiOrigin,
    gatewayOrigin,
    captured,
    state,
    consume,
    logs,
    values,
    token,
    authCalls: () => authCalls,
    async dispose() {
      await gateway.close();
      await close(relay);
      await ai.close();
      await close(auth);
      process.env = original;
    },
  };
}
function call(
  h: Awaited<ReturnType<typeof harness>>,
  method = 'POST',
  target = external,
  body?: string | object,
  key?: string,
  token = h.token(),
) {
  let req = request(h.gateway.getHttpServer())
    [method.toLowerCase() as 'post' | 'get' | 'delete' | 'head' | 'options'](target)
    .set('Authorization', `Bearer ${token}`);
  if (key) req = req.set('Idempotency-Key', key);
  return body === undefined ? req : req.send(body);
}

describe('Real Gateway controller, /me HTTP stub, signer/adapter and real AI HTTP security (business DB mocked)', () => {
  let h: Awaited<ReturnType<typeof harness>>;
  beforeAll(async () => {
    h = await harness();
  });
  afterAll(async () => {
    await h?.dispose();
  });
  beforeEach(() => {
    h.state.denied = false;
    h.state.malicious = false;
    h.state.forcedReply = undefined;
    h.state.admissionStatus = undefined;
    h.state.admissionCalls = [];
    h.state.duplicate = 0;
    h.state.dropResponse = false;
    h.state.mutate = undefined;
    h.state.authDelay = 0;
    h.state.relayDelay = 0;
  });
  it('admits only after current Auth validation using trusted tenant and owner', async () => {
    h.state.denied = true;
    expect((await call(h, 'GET', external)).status).toBe(401);
    expect(h.state.admissionCalls).toEqual([]);
    h.state.denied = false;
    h.state.admissionStatus = 429;
    const before = h.captured.length;
    const reply = await call(h, 'GET', external);
    expect(reply.status).toBe(429);
    expect(reply.headers['retry-after']).toBe('6');
    expect(h.state.admissionCalls).toEqual([['integration-tenant', 'integration-user', 'GET']]);
    expect(h.captured).toHaveLength(before);
    h.state.admissionStatus = 503;
    expect((await call(h, 'GET', external)).status).toBe(503);
  });
  it.each(['6', '0', '61', '1.5', 'private-canary'])(
    'bounds upstream Retry-After %s and never propagates sensitive fields',
    async (retry) => {
      h.state.forcedReply = { status: 429, retry };
      const reply = await call(h, 'GET', external);
      expect(reply.status).toBe(429);
      expect(reply.headers['retry-after']).toBe(retry === '6' ? '6' : '1');
      expect(reply.headers['set-cookie']).toBeUndefined();
      expect(reply.text).not.toContain('private-canary');
    },
  );
  it('propagates only the approved storage-quota code from an untrusted upstream error', async () => {
    h.state.forcedReply = { status: 409, code: 'AI_STORAGE_QUOTA_EXCEEDED' };
    const reply = await call(h, 'GET', external);
    expect(reply.status).toBe(409);
    expect((reply.body as { code: string }).code).toBe('AI_STORAGE_QUOTA_EXCEEDED');
    expect(reply.text).not.toContain('private-canary');
    h.state.forcedReply = { status: 409, code: 'private-canary' };
    expect(((await call(h, 'GET', external)).body as { code: string }).code).toBe('CONFLICT');
  });
  it.each([
    ['POST', external, {}, 'create', 201],
    ['GET', external, undefined, undefined, 200],
    ['GET', `${external}/${id}`, undefined, undefined, 200],
    ['POST', `${external}/${id}/messages`, { content: 'hello' }, 'append', 201],
    ['DELETE', `${external}/${id}`, undefined, undefined, 204],
  ] as const)('forwards exact %s %s', async (method, target, body, key, status) => {
    const reply = await call(h, method, target, body, key);
    expect(reply.status).toBe(status);
    expect(reply.headers['cache-control']).toBe('no-store');
    const wire = h.captured.at(-1)!;
    expect(wire.target).toBe(target.replace('/api/v1/ai', '/api'));
    expect(wire.headers.cookie).toBeUndefined();
    const proof = jwt.verify(
      String(wire.headers['x-ai-request-integrity']),
      Buffer.from(signing.key, 'base64'),
      { algorithms: ['HS256'], issuer: 'workphelo-gateway', audience: 'workphelo-ai-request' },
    ) as jwt.JwtPayload;
    expect(proof.bodyHash).toBe(hash(wire.body));
    expect(proof.bodyLength).toBe(wire.body.length);
    expect(wire.headers['idempotency-key']).toBe(key);
  });
  it('canonicalizes whitespace/escaping once before signing and preserves original message text', async () => {
    const text = ' café 🌍\n\t';
    const reply = await call(
      h,
      'POST',
      `${external}/${id}/messages`,
      ` { "content" : ${JSON.stringify(text)} } `,
      'bytes',
    ).set('Content-Type', 'application/json');
    expect(reply.status).toBe(201);
    expect(h.captured.at(-1)!.body.toString()).toBe(JSON.stringify({ content: text }));
    const absent = await call(h, 'POST', external, undefined, 'empty');
    expect(absent.status).toBe(415);
    expect((await call(h, 'POST', external, {}, 'present')).status).toBe(201);
  });
  it.each([undefined, 'https://evil.test', 'null'])(
    'requires trusted Origin for cookie mutation: %s',
    async (origin) => {
      const before = h.captured.length;
      let req = request(h.gateway.getHttpServer())
        .post(external)
        .set('Cookie', `access_token=${h.token()}`)
        .set('Idempotency-Key', 'cookie')
        .send({});
      if (origin) req = req.set('Origin', origin);
      expect((await req).status).toBe(403);
      expect(h.captured).toHaveLength(before);
    },
  );
  it.each(['http://localhost:3000', 'http://localhost:4000'])(
    'allows explicit trusted cookie Origin %s',
    async (origin) => {
      expect(
        (
          await request(h.gateway.getHttpServer())
            .post(external)
            .set('Cookie', `access_token=${h.token()}`)
            .set('Origin', origin)
            .set('Idempotency-Key', 'cookie')
            .send({})
        ).status,
      ).toBe(201);
    },
  );
  it('rejects conflicting credentials and does not let matching Bearer bypass cookie Origin', async () => {
    expect(
      (
        await call(h, 'POST', external, {}, 'conflict').set(
          'Cookie',
          `access_token=${h.token('other')}`,
        )
      ).status,
    ).toBe(400);
    const token = h.token();
    expect(
      (
        await call(h, 'POST', external, {}, 'matching', token).set(
          'Cookie',
          `access_token=${token}`,
        )
      ).status,
    ).toBe(403);
  });
  it.each([{ scope: 'careers' }, { scope: 'unsupported' }, { type: 'refresh' }])(
    'rejects restricted session %j before Auth/downstream',
    async (claims) => {
      const before = h.authCalls(),
        upstream = h.captured.length;
      expect(
        (
          await call(
            h,
            'GET',
            external,
            undefined,
            undefined,
            h.token(undefined, undefined, claims),
          )
        ).status,
      ).toBe(403);
      expect(h.authCalls()).toBe(before);
      expect(h.captured).toHaveLength(upstream);
    },
  );
  it('rejects revoked sessions on every fresh Gateway request', async () => {
    expect((await call(h, 'GET')).status).toBe(200);
    h.state.denied = true;
    const before = h.captured.length;
    expect((await call(h, 'GET')).status).toBe(401);
    expect(h.captured).toHaveLength(before);
  });
  it.each([
    external + '/',
    external + '//',
    external + '/%2f',
    external + '/bad-id',
    external + '?limit=1&limit=2',
    external + '?x=1',
  ])('rejects ambiguous route/query %s', async (target) => {
    const before = h.captured.length;
    expect((await call(h, 'GET', target)).status).toBeGreaterThanOrEqual(400);
    expect(h.captured).toHaveLength(before);
  });
  it.each(['HEAD', 'OPTIONS', 'PUT'])('does not sign unsupported method %s', async (method) => {
    const before = h.captured.length;
    expect((await call(h, method)).status).toBeGreaterThanOrEqual(400);
    expect(h.captured).toHaveLength(before);
  });
  it('fails closed when signing is disabled or prohibited in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.AI_REQUEST_SIGNING_ENABLED = 'false';
    expect((await call(h, 'GET')).status).toBe(503);
    process.env.AI_REQUEST_SIGNING_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    try {
      expect((await call(h, 'GET')).status).toBe(503);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
  it('strips spoofed identity/integrity and refuses identity-only direct AI calls', async () => {
    expect(
      (
        await call(h, 'GET')
          .set('x-user-id', 'spoofed')
          .set('x-tenant-id', 'spoofed')
          .set('x-ai-request-integrity', 'forged')
          .set('x-gateway-auth-context', 'forged')
      ).status,
    ).toBe(200);
    const wire = h.captured.at(-1)!;
    expect(wire.headers['x-user-id']).toBeUndefined();
    expect(wire.headers['x-gateway-auth-context']).not.toBe('forged');
    const headers = { ...wire.headers };
    delete headers['x-ai-request-integrity'];
    expect((await raw(h.aiOrigin, { ...wire, headers })).status).toBe(401);
    const replay = await Promise.all([raw(h.aiOrigin, wire), raw(h.aiOrigin, wire)]);
    expect(replay.map((r) => r.status)).toEqual([401, 401]);
  });
  it.each(['body', 'query', 'identity', 'idempotency', 'method', 'path', 'expired'])(
    'AI rejects post-signing %s substitution',
    async (kind) => {
      h.state.mutate = (original) => {
        const value = { ...original, headers: { ...original.headers } };
        if (kind === 'body') value.body = Buffer.from('{"content":"changed"}');
        if (kind === 'body') value.headers['content-length'] = String(value.body.length);
        if (kind === 'query') value.target += '?limit=1';
        if (kind === 'identity') value.headers['x-gateway-auth-context'] = 'forged';
        if (kind === 'idempotency') value.headers['idempotency-key'] = 'changed';
        if (kind === 'method') value.method = 'GET';
        if (kind === 'path') value.target = '/api/conversations/' + id;
        if (kind === 'expired') {
          const payload = jwt.decode(
            String(value.headers['x-ai-request-integrity']),
          ) as jwt.JwtPayload;
          value.headers['x-ai-request-integrity'] = jwt.sign(
            { ...payload, exp: Math.floor(Date.now() / 1000) - 1 },
            Buffer.from(signing.key, 'base64'),
            {
              algorithm: 'HS256',
              header: { alg: 'HS256', typ: 'workphelo.ai.request+jwt', kid: signing.id },
            },
          );
        }
        return value;
      };
      const reply = await call(
        h,
        'POST',
        `${external}/${id}/messages`,
        { content: 'secret-canary' },
        'integrity',
      );
      expect([400, 401, 403, 404]).toContain(reply.status);
      expect(reply.headers['cache-control']).toBe('no-store');
    },
  );
  it('sanitizes raw upstream errors and discards upstream cookies', async () => {
    h.state.malicious = true;
    const reply = await call(h, 'GET');
    expect(reply.status).toBe(503);
    expect(reply.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(reply.body)).not.toContain('private-upstream');
  });
  it('bounds raw wire input and rejects unsupported content type', async () => {
    expect(
      (await call(h, 'POST', external, 'x', 'type').set('Content-Type', 'text/plain')).status,
    ).toBe(415);
    expect((await call(h, 'POST', external, { content: 'a'.repeat(40000) }, 'size')).status).toBe(
      413,
    );
  });
  it('keeps eligibility/probes independent and fails closed for downstream feature disablement', async () => {
    expect((await call(h, 'GET', '/api/v1/ai/eligibility')).status).toBe(200);
    expect((await request(h.ai.getHttpServer()).get('/api/health')).status).toBe(200);
    expect((await call(h, 'GET', '/api/v1/ai/health')).status).toBe(404);
    h.values.AI_CONVERSATION_HTTP_ENABLED = false;
    try {
      const reply = await call(h, 'GET');
      expect(reply.status).toBe(503);
    } finally {
      h.values.AI_CONVERSATION_HTTP_ENABLED = true;
    }
  });
  it('keeps Auth lookup within the shared five-second AI budget', async () => {
    h.state.authDelay = 6000;
    const before = h.captured.length,
      started = Date.now();
    expect((await call(h, 'GET')).status).toBe(504);
    expect(Date.now() - started).toBeLessThan(5700);
    expect(h.captured).toHaveLength(before);
  }, 10000);
});

const databaseUrl = process.env.AI_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)(
  'Gateway -> real AI -> REAL disposable PostgreSQL; Auth /me remains explicitly stubbed',
  () => {
    let h: Awaited<ReturnType<typeof harness>>, db: ReturnType<typeof createAiClient>;
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/workphelo_ai_2b1' ||
        url.searchParams.get('schema') !== 'ai'
      )
        throw new Error('Disposable database only');
      h = await harness(databaseUrl);
      db = createAiClient(databaseUrl!);
      await db.$connect();
    });
    afterAll(async () => {
      await h?.dispose();
      await db?.$disconnect();
    });
    it('executes all five operations with encrypted-only persistence, fixed expiry and cascade deletion', async () => {
      const token = h.token(randomUUID(), randomUUID()),
        key = randomUUID();
      const created = await call(h, 'POST', external, {}, key, token);
      expect(created.status).toBe(201);
      const result = created.body as { id: string; createdAt: string; expiresAt: string };
      expect(Date.parse(result.expiresAt) - Date.parse(result.createdAt)).toBe(720 * 3600000);
      const target = `${external}/${result.id}`;
      const content = ' exact 🌍\n\t';
      expect(
        (await call(h, 'POST', target + '/messages', { content }, 'message', token)).status,
      ).toBe(201);
      const stored = await db.aiConversationMessage.findFirstOrThrow({
        where: { conversationId: result.id },
      });
      expect(stored.ciphertext.toString('utf8')).not.toContain(content);
      expect(stored.role).toBe('USER');
      const list = await call(h, 'GET', external + '?limit=%32', undefined, undefined, token);
      expect(list.status).toBe(200);
      expect((list.body as { items: { id: string }[] }).items[0].id).toBe(result.id);
      const detail = await call(h, 'GET', target, undefined, undefined, token);
      expect(detail.status).toBe(200);
      expect(
        (detail.body as { messages: { items: { content: string }[] } }).messages.items[0].content,
      ).toBe(content);
      expect(
        (
          await db.aiConversation.findUniqueOrThrow({ where: { id: result.id } })
        ).expiresAt.toISOString(),
      ).toBe(result.expiresAt);
      expect((await call(h, 'DELETE', target, undefined, undefined, token)).status).toBe(204);
      expect(await db.aiConversationMessage.count({ where: { conversationId: result.id } })).toBe(
        0,
      );
      expect((await call(h, 'POST', external, {}, key, token)).status).toBe(404);
      expect(JSON.stringify(h.logs)).not.toContain(content);
    });
    it('handles concurrent matching creates/appends, changed-content conflict and response-loss retry', async () => {
      const token = h.token(randomUUID(), randomUUID()),
        key = randomUUID();
      const replies = await Promise.all(
        Array.from({ length: 6 }, () =>
          afterCapacity(() => call(h, 'POST', external, {}, key, token)),
        ),
      );
      expect(replies.every((r) => r.status === 201)).toBe(true);
      expect(new Set(replies.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      const result = replies[0].body as { id: string };
      const target = `${external}/${result.id}/messages`;
      const messages = await Promise.all(
        Array.from({ length: 6 }, () =>
          afterCapacity(() => call(h, 'POST', target, { content: 'retry' }, 'same-key', token)),
        ),
      );
      expect(messages.every((r) => r.status === 201)).toBe(true);
      expect(new Set(messages.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      expect((await call(h, 'POST', target, { content: 'retry' }, 'same-key', token)).body).toEqual(
        messages[0].body,
      );
      expect(
        (await call(h, 'POST', target, { content: 'different' }, 'same-key', token)).status,
      ).toBe(409);
      expect(await db.aiConversationMessage.count({ where: { conversationId: result.id } })).toBe(
        1,
      );
    });
    it('denies cross-tenant and cross-user access without administrator bypass', async () => {
      const tenant = randomUUID(),
        token = h.token(randomUUID(), tenant);
      const created = await call(h, 'POST', external, {}, randomUUID(), token);
      const target = `${external}/${(created.body as { id: string }).id}`;
      for (const foreign of [h.token(randomUUID(), tenant), h.token(randomUUID(), randomUUID())])
        for (const method of ['GET', 'DELETE', 'POST'])
          expect(
            (
              await call(
                h,
                method,
                method === 'POST' ? target + '/messages' : target,
                method === 'POST' ? { content: 'x' } : undefined,
                method === 'POST' ? randomUUID() : undefined,
                foreign,
              )
            ).status,
          ).toBe(404);
    });
    it('consumes one proof atomically before concurrent duplicate forwarding', async () => {
      h.state.duplicate = 8;
      try {
        expect(
          (await call(h, 'POST', external, {}, randomUUID(), h.token(randomUUID(), randomUUID())))
            .status,
        ).toBe(201);
        expect(h.state.duplicateStatuses.filter((status) => status === 201)).toHaveLength(1);
        expect(h.state.duplicateStatuses.filter((status) => status === 401)).toHaveLength(7);
      } finally {
        h.state.duplicate = 0;
      }
    });
    it('recovers an actual dropped client response after a durable commit without duplicating creation', async () => {
      const user = randomUUID(),
        token = h.token(user, randomUUID()),
        key = randomUUID();
      const url = new URL(h.gatewayOrigin);
      h.state.dropResponse = true;
      const client = http.request({
        hostname: url.hostname,
        port: url.port,
        method: 'POST',
        path: external,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'content-length': '2',
          'idempotency-key': key,
        },
      });
      client.on('error', () => undefined);
      client.end('{}');
      try {
        for (
          let attempt = 0;
          attempt < 80 && (await db.aiConversation.count({ where: { ownerUserId: user } })) === 0;
          attempt++
        )
          await new Promise((resolve) => setTimeout(resolve, 25));
        expect(await db.aiConversation.count({ where: { ownerUserId: user } })).toBe(1);
      } finally {
        client.destroy();
        h.state.dropResponse = false;
      }
      expect((await call(h, 'POST', external, {}, key, token)).status).toBe(201);
      expect(await db.aiConversation.count({ where: { ownerUserId: user } })).toBe(1);
    });
    it('leaves proof spent after business rollback and requires a fresh proof for retry', async () => {
      const target = `${external}/${randomUUID()}/messages`;
      expect((await call(h, 'POST', target, { content: 'missing' }, randomUUID())).status).toBe(
        404,
      );
      expect((await raw(h.aiOrigin, h.captured.at(-1)!)).status).toBe(401);
    });
    it('fails closed on nonce-store/database outages and signing-key mismatch', async () => {
      const nonce = jest
        .spyOn(h.ai.get(RequestNonceStore), 'consume')
        .mockRejectedValueOnce(new ServiceUnavailableException());
      expect((await call(h, 'GET')).status).toBe(503);
      nonce.mockRestore();
      const database = h.ai.get(AiDatabaseService);
      await database.onModuleDestroy();
      try {
        expect((await call(h, 'GET')).status).toBe(503);
      } finally {
        await database.onModuleInit();
      }
      const wrong = entry(74);
      process.env.AI_REQUEST_SIGNING_KEY = wrong.key;
      process.env.AI_REQUEST_SIGNING_KEY_ID = wrong.id;
      try {
        expect((await call(h, 'GET')).status).toBe(401);
      } finally {
        process.env.AI_REQUEST_SIGNING_KEY = signing.key;
        process.env.AI_REQUEST_SIGNING_KEY_ID = signing.id;
      }
    });
  },
);
