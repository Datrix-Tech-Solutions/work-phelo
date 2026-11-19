import {
  CallHandler,
  ExecutionContext,
  INestApplication,
  NestInterceptor,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Server } from 'http';
import * as jwt from 'jsonwebtoken';
import request, { Response } from 'supertest';
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
import { MAX_DETAIL_RESPONSE_BYTES } from '../persistence/conversation-operations.service';
import { MessageEncryptionService } from '../encryption/message-encryption.service';
import {
  listCursor,
  listPosition,
  messageCursor,
  messagePosition,
} from '../persistence/conversation-pagination';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const field = (name: string, value: string) =>
  hash(JSON.stringify(['workphelo.ai.request', 1, name, value]));
const key = (n: number) => {
  const bytes = Buffer.alloc(32, n);
  return { id: hash(bytes), key: bytes.toString('base64') };
};
const encryption = key(31),
  fingerprint = key(32),
  signing = key(33);
const secret = 'http-fixture-only-jwt-not-production';
const id = 'abcdef01-1111-4111-8111-111111111111';
const prefix = '/api/conversations';
const defaults = {
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_POLICY_VERSION: 'http-test',
  JWT_SECRET: secret,
  AI_AUTHENTICATED_ROUTES_ENABLED: 'true',
  AI_PERSISTENCE_ENABLED: 'true',
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai',
  AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
  AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([encryption]),
  AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: encryption.id,
  AI_MESSAGE_OPERATIONS_ENABLED: 'true',
  AI_FINGERPRINT_KEYS: JSON.stringify([fingerprint]),
  AI_FINGERPRINT_ACTIVE_KEY_ID: fingerprint.id,
  AI_REQUEST_VERIFICATION_ENABLED: 'true',
  AI_REQUEST_VERIFICATION_KEYS: JSON.stringify([signing]),
  AI_CONVERSATION_HTTP_ENABLED: 'true',
};
interface Input {
  method: string;
  target: string;
  body?: string;
  key?: string;
  user?: string;
  tenant?: string;
  claims?: Record<string, unknown>;
  proof?: Record<string, unknown>;
}
function wire(input: Input) {
  const user = input.user ?? 'http-user',
    tenant = input.tenant ?? 'http-tenant';
  const token = jwt.sign({ sub: user, tenantId: tenant, ...input.claims }, secret, {
    expiresIn: '15m',
  });
  const permissions = '[]';
  const identity = jwt.sign(
    {
      user: {
        id: user,
        tenantId: tenant,
        role: 'TENANT_ADMIN',
        email: '',
        tenantSlug: 'fixture',
        tenantName: 'Fixture',
        firstName: 'Fixture',
        moduleConfig: {},
        featureConfig: {},
      },
      tokenHash: hash(token),
      permissionsHash: hash(permissions),
    },
    secret,
    { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
  );
  const body = input.body ?? '',
    iat = Math.floor(Date.now() / 1000);
  const [path, query = ''] = input.target.split('?');
  const proof = jwt.sign(
    {
      v: 1,
      iss: 'workphelo-gateway',
      aud: 'workphelo-ai-request',
      iat,
      exp: iat + 10,
      deadlineAtMs: Date.now() + 5000,
      jti: randomBytes(32).toString('base64url'),
      requestId: randomUUID(),
      method: input.method,
      pathHash: field('path', path),
      queryHash: field('raw-query', query),
      bodyHash: hash(body),
      bodyLength: Buffer.byteLength(body),
      contentType: input.body === undefined ? '' : 'application/json; charset=utf-8',
      tokenHash: hash(token),
      identityAssertionHash: hash(identity),
      idempotencyKeyHash: field('idempotency-key', JSON.stringify(input.key ?? null)),
      ...input.proof,
    },
    Buffer.from(signing.key, 'base64'),
    {
      algorithm: 'HS256',
      header: { alg: 'HS256', typ: 'workphelo.ai.request+jwt', kid: signing.id },
    },
  );
  return {
    ...input,
    headers: {
      authorization: `Bearer ${token}`,
      'x-gateway-auth-context': identity,
      'x-user-permissions': permissions,
      'x-ai-request-integrity': proof,
      'content-length': String(Buffer.byteLength(body)),
      ...(input.body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
      ...(input.key === undefined ? {} : { 'idempotency-key': input.key }),
    } as Record<string, string>,
  };
}
function send(app: INestApplication<Server>, value: ReturnType<typeof wire>) {
  const operation = value.method.toLowerCase() as 'get' | 'post' | 'delete' | 'head' | 'options';
  const call = request(app.getHttpServer())[operation](value.target).set(value.headers);
  return value.body === undefined ? call : call.send(value.body);
}
async function harness(databaseUrl?: string) {
  const original = process.env;
  process.env = { ...defaults, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) };
  const values: Record<string, unknown> = { ...parseRuntimeEnv(process.env) };
  const spent = new Set<string>();
  const events: string[] = [],
    logs: unknown[] = [];
  const consume = jest.fn((digest: Buffer) => {
    const value = digest.toString('hex');
    if (spent.has(value)) return Promise.reject(new UnauthorizedException());
    spent.add(value);
    events.push('nonce');
    return Promise.resolve();
  });
  const facade = {
    createIdempotent: jest.fn(() => ({ id, createdAt: new Date(0), expiresAt: new Date(1) })),
    listPage: jest.fn(() => ({ items: [], nextCursor: null })),
    detail: jest.fn(() => ({ conversation: { id }, messages: { items: [], nextCursor: null } })),
    append: jest.fn(() => ({ id, role: 'USER', sequence: 1 })),
    delete: jest.fn(() => undefined),
  };
  try {
    let builder = Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (name: string) => values[name],
        getOrThrow: (name: string) => {
          if (values[name] === undefined) throw new Error('Fixture config');
          return values[name];
        },
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
        .useValue(facade);
    const module = await builder.compile();
    const app = module.createNestApplication<INestApplication<Server>>({
      bodyParser: false,
      logger: false,
    });
    const interceptor: NestInterceptor = {
      intercept: (_context: ExecutionContext, next: CallHandler) => {
        events.push('interceptor');
        return next.handle();
      },
    };
    app.useGlobalInterceptors(interceptor);
    configureApplication(app, (value) => logs.push(value), true);
    await app.init();
    return { app, facade, consume, events, logs, config: app.get(ConfigService) };
  } finally {
    process.env = original;
  }
}
const createInput = (key: string = randomUUID()): Input => ({
  method: 'POST',
  target: prefix,
  body: '{}',
  key,
});
function safe(reply: Response, status: number) {
  expect(reply.status).toBe(status);
  expect(reply.headers['cache-control']).toBe('no-store');
  expect(Object.keys(reply.body as object).sort()).toEqual([
    'code',
    'message',
    'requestId',
    'statusCode',
  ]);
}

describe('Production conversation controllers: actual Nest guards, DTOs and interceptors; mocked business storage', () => {
  let h: Awaited<ReturnType<typeof harness>>;
  beforeAll(async () => {
    h = await harness();
  });
  afterAll(async () => {
    await h?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    h.events.length = 0;
  });
  it.each([
    { ...createInput(), status: 201, operation: 'createIdempotent' },
    { method: 'GET', target: prefix, status: 200, operation: 'listPage' },
    { method: 'GET', target: `${prefix}/${id}`, status: 200, operation: 'detail' },
    {
      method: 'POST',
      target: `${prefix}/${id}/messages`,
      body: '{"content":"hello"}',
      key: 'append',
      status: 201,
      operation: 'append',
    },
    { method: 'DELETE', target: `${prefix}/${id}`, status: 204, operation: 'delete' },
  ])('serves $method $target through the exact approved policy', async (input) => {
    const reply = await send(h.app, wire(input));
    expect(reply.status).toBe(input.status);
    if (input.status === 204) expect(reply.text).toBe('');
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(h.facade[input.operation as keyof typeof h.facade]).toHaveBeenCalledTimes(1);
    expect(h.events).toEqual(['nonce', 'interceptor']);
  });
  it.each([
    'AI_CONVERSATION_HTTP_ENABLED',
    'AI_AUTHENTICATED_ROUTES_ENABLED',
    'AI_PERSISTENCE_ENABLED',
    'AI_MESSAGE_ENCRYPTION_ENABLED',
    'AI_MESSAGE_OPERATIONS_ENABLED',
    'AI_REQUEST_VERIFICATION_ENABLED',
  ])('denies disabled %s before nonce/interceptor/storage', async (flag) => {
    h.config.set(flag, false);
    try {
      safe(await send(h.app, wire(createInput())), 503);
      expect(h.consume).not.toHaveBeenCalled();
      expect(h.events).toEqual([]);
      expect(h.facade.createIdempotent).not.toHaveBeenCalled();
    } finally {
      h.config.set(flag, true);
    }
  });
  it.each(['authorization', 'x-gateway-auth-context', 'x-ai-request-integrity'])(
    'rejects missing %s',
    async (name) => {
      const value = wire(createInput());
      delete value.headers[name];
      safe(await send(h.app, value), 401);
      expect(h.facade.createIdempotent).not.toHaveBeenCalled();
    },
  );
  it('rejects a forged proof and unavailable nonce storage', async () => {
    const value = wire(createInput());
    value.headers['x-ai-request-integrity'] = 'forged';
    safe(await send(h.app, value), 401);
    h.consume.mockRejectedValueOnce(new ServiceUnavailableException());
    safe(await send(h.app, wire(createInput())), 503);
    expect(h.facade.createIdempotent).not.toHaveBeenCalled();
  });
  it('rejects spent proofs before interceptor or business execution', async () => {
    const value = wire(createInput());
    expect((await send(h.app, value)).status).toBe(201);
    safe(await send(h.app, value), 401);
    expect(h.facade.createIdempotent).toHaveBeenCalledTimes(1);
  });
  it.each(['HEAD', 'OPTIONS'])('denies %s aliases without consuming', async (method) => {
    const reply = await send(h.app, wire({ method, target: prefix }));
    expect(reply.status).toBeGreaterThanOrEqual(400);
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(h.consume).not.toHaveBeenCalled();
  });
  it.each([
    `${prefix}/`,
    '/api/Conversations',
    `${prefix}/NOT-A-UUID`,
    `${prefix}/${id.toUpperCase()}`,
  ])('rejects noncanonical target %s', async (target) => {
    expect((await send(h.app, wire({ method: 'GET', target }))).status).toBeGreaterThanOrEqual(400);
    expect(h.consume).not.toHaveBeenCalled();
  });
  it.each(['null', '[]', '"text"', '{"tenantId":"foreign"}', '{"expiresAt":"2030-01-01"}'])(
    'rejects invalid creation body %s',
    async (body) => {
      safe(await send(h.app, wire({ ...createInput(), body })), 400);
      expect(h.facade.createIdempotent).not.toHaveBeenCalled();
    },
  );
  it('requires create JSON body and idempotency header', async () => {
    const input = createInput();
    delete input.key;
    safe(await send(h.app, wire(input)), 400);
    const empty = createInput();
    delete empty.body;
    safe(await send(h.app, wire(empty)), 415);
  });
  it.each([
    { content: '' },
    { content: 7 },
    { content: 'x', role: 'ASSISTANT' },
    { content: 'x', ownerUserId: 'other' },
    { content: 'x', sequence: 5 },
    { content: '\ud800' },
  ])('rejects invalid append DTO %j', async (body) => {
    safe(
      await send(
        h.app,
        wire({
          method: 'POST',
          target: `${prefix}/${id}/messages`,
          key: 'key',
          body: JSON.stringify(body),
        }),
      ),
      400,
    );
    expect(h.facade.append).not.toHaveBeenCalled();
  });
  it('preserves exact UTF-8 content and enforces decoded and wire byte limits', async () => {
    const content = '  café 🌍\n\t';
    const input = {
      method: 'POST',
      target: `${prefix}/${id}/messages`,
      key: 'unicode',
      body: JSON.stringify({ content }),
    };
    expect((await send(h.app, wire(input))).status).toBe(201);
    expect(h.facade.append).toHaveBeenLastCalledWith(expect.anything(), content, 'unicode');
    for (const [size, status] of [
      [16384, 201],
      [16385, 400],
      [40000, 413],
    ]) {
      const reply = await send(
        h.app,
        wire({ ...input, body: JSON.stringify({ content: 'a'.repeat(size) }) }),
      );
      expect(reply.status).toBe(status);
      expect(reply.headers['cache-control']).toBe('no-store');
    }
  });
  it('returns 415 for unsupported media without consuming', async () => {
    const value = wire(createInput());
    value.headers['content-type'] = 'text/plain';
    safe(await send(h.app, value), 415);
    expect(h.consume).not.toHaveBeenCalled();
  });
  it('applies the decoded limit to UTF-8 bytes rather than character count', async () => {
    for (const [count, status] of [
      [4096, 201],
      [4097, 400],
    ]) {
      expect(
        (
          await send(
            h.app,
            wire({
              method: 'POST',
              target: `${prefix}/${id}/messages`,
              key: 'utf8-boundary',
              body: JSON.stringify({ content: '🌍'.repeat(count) }),
            }),
          )
        ).status,
      ).toBe(status);
    }
  });
  it.each([
    'limit=0',
    'limit=101',
    'limit=01',
    'limit=2&limit=3',
    'unknown=x',
    'cursor=not-json',
    `cursor=${'a'.repeat(257)}`,
  ])('rejects invalid query %s', async (query) => {
    const reply = await send(h.app, wire({ method: 'GET', target: `${prefix}?${query}` }));
    expect(reply.status).toBeGreaterThanOrEqual(400);
    expect(h.facade.listPage).not.toHaveBeenCalled();
  });
  it('rejects body/idempotency on GET and DELETE and JSON errors without leaking body', async () => {
    safe(await send(h.app, wire({ method: 'GET', target: prefix, key: 'unwanted' })), 400);
    safe(
      await send(h.app, wire({ method: 'DELETE', target: `${prefix}/${id}`, key: 'unwanted' })),
      400,
    );
    safe(await send(h.app, wire({ ...createInput(), body: '{"private-canary":' })), 400);
    expect(JSON.stringify(h.logs)).not.toContain('private-canary');
  });
  it('keeps deadline expiry structured and blocks business execution after nonce wait', async () => {
    h.consume.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 100)));
    safe(
      await send(h.app, wire({ ...createInput(), proof: { deadlineAtMs: Date.now() + 60 } })),
      504,
    );
    expect(h.facade.createIdempotent).not.toHaveBeenCalled();
  });
  it('retains unchanged probes and eligibility without proof or storage', async () => {
    expect((await request(h.app.getHttpServer()).get('/api/health')).status).toBe(200);
    const ready = await request(h.app.getHttpServer()).get('/api/ready');
    expect((ready.body as { inferenceAvailable: boolean }).inferenceAvailable).toBe(false);
    const eligibility = await request(h.app.getHttpServer())
      .get('/api/eligibility')
      .set(wire({ method: 'GET', target: prefix }).headers);
    expect(eligibility.status).toBe(200);
    expect(h.consume).not.toHaveBeenCalled();
  });
});

describe('Bounded position cursors (not authorization)', () => {
  it('rejects production conversation enablement even with otherwise valid configuration', () => {
    expect(() => parseRuntimeEnv({ ...defaults, NODE_ENV: 'production' })).toThrow(
      'AI_CONVERSATION_HTTP_ENABLED',
    );
  });
  it('round trips canonical list and message positions', () => {
    const row = { id, createdAt: new Date('2026-11-19T00:00:00.000Z') };
    expect(listPosition(listCursor(row))).toEqual(row);
    expect(messagePosition(messageCursor(7))).toBe(7);
  });
  it.each([
    '',
    'a'.repeat(257),
    'bad=',
    Buffer.from('[2,1]').toString('base64url'),
    Buffer.from('[1,-1]').toString('base64url'),
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() => listPosition(cursor)).toThrow();
    expect(() => messagePosition(cursor)).toThrow();
  });
});

const databaseUrl = process.env.AI_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)(
  'Conversation HTTP with REAL disposable PostgreSQL, encryption and nonce storage',
  () => {
    let h: Awaited<ReturnType<typeof harness>>, db: ReturnType<typeof createAiClient>;
    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/workphelo_ai_2b1' ||
        url.searchParams.get('schema') !== 'ai'
      )
        throw new Error('Disposable AI database only');
      h = await harness(databaseUrl);
      db = createAiClient(databaseUrl!);
      await db.$connect();
    });
    afterAll(async () => {
      await h?.app.close();
      await db?.$disconnect();
    });
    async function create(key = randomUUID(), user = randomUUID(), tenant = randomUUID()) {
      const reply = await send(h.app, wire({ ...createInput(key), user, tenant }));
      expect(reply.status).toBe(201);
      return { conversationId: (reply.body as { id: string }).id, user, tenant, key, reply };
    }
    async function expiredFixture(row: Awaited<ReturnType<typeof create>>) {
      // Production metadata is immutable. Seed a pre-expired row only in this guarded disposable DB.
      await db.aiConversation.delete({ where: { id: row.conversationId } });
      await db.aiConversation.create({
        data: {
          id: row.conversationId,
          tenantId: row.tenant,
          ownerUserId: row.user,
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
    }
    it('creates once concurrently and recovers response loss with a fresh proof', async () => {
      const input = {
        ...createInput('concurrent-create'),
        user: randomUUID(),
        tenant: randomUUID(),
      };
      const replies = await Promise.all(Array.from({ length: 8 }, () => send(h.app, wire(input))));
      expect(replies.every((r) => r.status === 201)).toBe(true);
      expect(new Set(replies.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      expect(await db.aiConversation.count({ where: { ownerUserId: input.user } })).toBe(1);
      expect(
        await db.aiSubmissionReceipt.count({
          where: { ownerUserId: input.user, operation: 'CREATE_CONVERSATION' },
        }),
      ).toBe(1);
      const value = wire(input);
      expect((await send(h.app, value)).body).toEqual(replies[0].body);
      safe(await send(h.app, value), 401);
    });
    it('returns safe conflict for a different stored creation fingerprint', async () => {
      const row = await create();
      await db.aiSubmissionReceipt.updateMany({
        where: { ownerUserId: row.user },
        data: { requestFingerprint: Buffer.alloc(32) },
      });
      const reply = await send(
        h.app,
        wire({ ...createInput(row.key), user: row.user, tenant: row.tenant }),
      );
      safe(reply, 409);
      expect((reply.body as { code: string }).code).toBe('CONFLICT');
    });
    it('clips a blocked creation transaction to the signed deadline without spending a business result', async () => {
      const user = randomUUID(),
        tenant = randomUUID(),
        key = randomUUID();
      let acquired!: () => void, release!: () => void;
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const scope = JSON.stringify(['ai.create.v1', tenant, user, key]);
      const blocker = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
          acquired();
          await held;
        },
        { timeout: 5000 },
      );
      await ready;
      const value = wire({
        ...createInput(key),
        user,
        tenant,
        proof: { deadlineAtMs: Date.now() + 600 },
      });
      try {
        safe(await send(h.app, value), 504);
      } finally {
        release();
        await blocker;
      }
      expect(await db.aiConversation.count({ where: { ownerUserId: user } })).toBe(0);
      safe(await send(h.app, value), 401);
      expect((await send(h.app, wire({ ...createInput(key), user, tenant }))).status).toBe(201);
      expect(await db.aiConversation.count({ where: { ownerUserId: user } })).toBe(1);
    });
    it('rolls back conversation creation when its receipt cannot be persisted', async () => {
      const user = randomUUID();
      const database = h.app.get(AiDatabaseService);
      const original = database.transaction.bind(database);
      const spy = jest.spyOn(database, 'transaction').mockImplementation((operation, deadline) =>
        original(
          (tx) =>
            operation(
              new Proxy(tx, {
                get(target, property) {
                  if (property === 'aiSubmissionReceipt')
                    return {
                      ...target.aiSubmissionReceipt,
                      create: () => Promise.reject(new Error('private-receipt-failure')),
                    };
                  return Reflect.get(target, property) as unknown;
                },
              }),
            ),
          deadline,
        ),
      );
      try {
        safe(await send(h.app, wire({ ...createInput(), user })), 503);
      } finally {
        spy.mockRestore();
      }
      expect(await db.aiConversation.count({ where: { ownerUserId: user } })).toBe(0);
    });
    it('pages metadata by a stable owned seek even when the cursor row is deleted', async () => {
      const user = randomUUID(),
        tenant = randomUUID();
      for (let i = 0; i < 4; i++) await create(randomUUID(), user, tenant);
      const first = await send(
        h.app,
        wire({ method: 'GET', target: `${prefix}?limit=2`, user, tenant }),
      );
      const page = first.body as { items: { id: string }[]; nextCursor: string };
      expect(page.items).toHaveLength(2);
      await db.aiConversation.delete({ where: { id: page.items[1].id } });
      const second = await send(
        h.app,
        wire({
          method: 'GET',
          target: `${prefix}?limit=2&cursor=${page.nextCursor}`,
          user,
          tenant,
        }),
      );
      expect((second.body as { items: { id: string }[] }).items).toHaveLength(2);
      expect(
        (second.body as { items: { id: string }[] }).items.some(
          (item) => item.id === page.items[0].id,
        ),
      ).toBe(false);
      const outsider = await send(
        h.app,
        wire({
          method: 'GET',
          target: `${prefix}?cursor=${page.nextCursor}`,
          user: 'other',
          tenant,
        }),
      );
      expect((outsider.body as { items: unknown[] }).items).toEqual([]);
    });
    it('seeks deterministically through equal createdAt timestamps by UUID', async () => {
      const user = randomUUID(),
        tenant = randomUUID(),
        createdAt = new Date(Date.now() - 1000);
      const ids = Array.from({ length: 3 }, () => randomUUID())
        .sort()
        .reverse();
      await db.aiConversation.createMany({
        data: ids.map((id) => ({
          id,
          tenantId: tenant,
          ownerUserId: user,
          createdAt,
          expiresAt: new Date(Date.now() + 3600000),
        })),
      });
      const first = await send(
        h.app,
        wire({ method: 'GET', target: `${prefix}?limit=1`, user, tenant }),
      );
      const page = first.body as { items: { id: string }[]; nextCursor: string };
      expect(page.items[0].id).toBe(ids[0]);
      const second = await send(
        h.app,
        wire({
          method: 'GET',
          target: `${prefix}?limit=2&cursor=${page.nextCursor}`,
          user,
          tenant,
        }),
      );
      expect((second.body as { items: { id: string }[] }).items.map((row) => row.id)).toEqual(
        ids.slice(1),
      );
    });
    it('appends once concurrently, preserves content and rejects conflicting retries', async () => {
      const row = await create(),
        target = `${prefix}/${row.conversationId}/messages`,
        content = '  café 🌍\n\t';
      const input = {
        method: 'POST',
        target,
        user: row.user,
        tenant: row.tenant,
        key: 'append',
        body: JSON.stringify({ content }),
      };
      const replies = await Promise.all(Array.from({ length: 6 }, () => send(h.app, wire(input))));
      expect(replies.every((r) => r.status === 201)).toBe(true);
      expect(new Set(replies.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      safe(await send(h.app, wire({ ...input, body: '{"content":"changed"}' })), 409);
      const detail = await send(
        h.app,
        wire({
          method: 'GET',
          target: `${prefix}/${row.conversationId}`,
          user: row.user,
          tenant: row.tenant,
        }),
      );
      expect(detail.status).toBe(200);
      const body = detail.body as { messages: { items: { content: string }[] } };
      expect(body.messages.items[0].content).toBe(content);
      for (const hidden of ['ciphertext', 'authenticationTag', 'keyId', 'fingerprint'])
        expect(JSON.stringify(detail.body)).not.toContain(hidden);
      expect(JSON.stringify(h.logs)).not.toContain(content);
    });
    it.each(['foreign-tenant', 'foreign-user', 'expired', 'deleted', 'missing'])(
      'returns indistinguishable 404 for %s across read/append/delete',
      async (kind) => {
        const row = await create();
        if (kind === 'expired') await expiredFixture(row);
        if (kind === 'deleted')
          await db.aiConversation.delete({ where: { id: row.conversationId } });
        const identity = {
          user: kind === 'foreign-user' ? 'outsider' : row.user,
          tenant: kind === 'foreign-tenant' ? 'outsider' : row.tenant,
        };
        const target = `${prefix}/${kind === 'missing' ? randomUUID() : row.conversationId}`;
        for (const method of ['GET', 'POST', 'DELETE'])
          safe(
            await send(
              h.app,
              wire({
                method,
                target: method === 'POST' ? target + '/messages' : target,
                ...identity,
                ...(method === 'POST' ? { body: '{"content":"x"}', key: 'absent' } : {}),
              }),
            ),
            404,
          );
      },
    );
    it('does not resurrect deleted/expired creation results on receipt replay', async () => {
      for (const kind of ['deleted', 'expired']) {
        const row = await create();
        if (kind === 'deleted')
          expect(
            (
              await send(
                h.app,
                wire({
                  method: 'DELETE',
                  target: `${prefix}/${row.conversationId}`,
                  user: row.user,
                  tenant: row.tenant,
                }),
              )
            ).status,
          ).toBe(204);
        else await expiredFixture(row);
        safe(
          await send(h.app, wire({ ...createInput(row.key), user: row.user, tenant: row.tenant })),
          404,
        );
      }
    });
    it('bounds decrypted response bytes and does not decrypt rows outside the requested count', async () => {
      const row = await create(),
        target = `${prefix}/${row.conversationId}`;
      for (let i = 0; i < 18; i++)
        expect(
          (
            await send(
              h.app,
              wire({
                method: 'POST',
                target: target + '/messages',
                user: row.user,
                tenant: row.tenant,
                key: `page-${i}`,
                body: JSON.stringify({ content: 'a'.repeat(16384) }),
              }),
            )
          ).status,
        ).toBe(201);
      const decrypt = jest.spyOn(h.app.get(MessageEncryptionService), 'decryptMessage');
      try {
        const one = await send(
          h.app,
          wire({ method: 'GET', target: target + '?limit=1', user: row.user, tenant: row.tenant }),
        );
        expect(one.status).toBe(200);
        expect(decrypt).toHaveBeenCalledTimes(1);
        const all = await send(
          h.app,
          wire({
            method: 'GET',
            target: target + '?limit=100',
            user: row.user,
            tenant: row.tenant,
          }),
        );
        expect(all.status).toBe(200);
        expect(Buffer.byteLength(all.text)).toBeLessThanOrEqual(MAX_DETAIL_RESPONSE_BYTES);
        const messages = (all.body as { messages: { items: unknown[]; nextCursor: string } })
          .messages;
        expect(messages.items.length).toBeLessThan(18);
        expect(messages.nextCursor).toBeTruthy();
        const next = await send(
          h.app,
          wire({
            method: 'GET',
            target: `${target}?cursor=${messages.nextCursor}`,
            user: row.user,
            tenant: row.tenant,
          }),
        );
        expect(
          (next.body as { messages: { items: unknown[] } }).messages.items.length +
            messages.items.length,
        ).toBe(18);
      } finally {
        decrypt.mockRestore();
      }
    });
    it('fails the whole selected page on ciphertext authentication failure', async () => {
      const row = await create(),
        target = `${prefix}/${row.conversationId}`;
      expect(
        (
          await send(
            h.app,
            wire({
              method: 'POST',
              target: target + '/messages',
              user: row.user,
              tenant: row.tenant,
              key: 'corrupt',
              body: '{"content":"private-ciphertext-canary"}',
            }),
          )
        ).status,
      ).toBe(201);
      await db.aiConversationMessage.updateMany({
        where: { conversationId: row.conversationId },
        data: { authenticationTag: Buffer.alloc(16) },
      });
      safe(
        await send(h.app, wire({ method: 'GET', target, user: row.user, tenant: row.tenant })),
        503,
      );
      expect(JSON.stringify(h.logs)).not.toContain('private-ciphertext-canary');
    });
    it('preserves atomic cascade deletion and concurrent read/append safety', async () => {
      const row = await create(),
        target = `${prefix}/${row.conversationId}`,
        identity = { user: row.user, tenant: row.tenant };
      const results = await Promise.all([
        send(h.app, wire({ method: 'DELETE', target, ...identity })),
        send(h.app, wire({ method: 'GET', target, ...identity })),
        send(
          h.app,
          wire({
            method: 'POST',
            target: target + '/messages',
            body: '{"content":"race"}',
            key: 'race',
            ...identity,
          }),
        ),
      ]);
      expect(results[0].status).toBe(204);
      expect([200, 404]).toContain(results[1].status);
      expect([201, 404]).toContain(results[2].status);
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: row.conversationId } }),
      ).toBe(0);
      expect(await db.aiConversation.count({ where: { id: row.conversationId } })).toBe(0);
    });
  },
);
