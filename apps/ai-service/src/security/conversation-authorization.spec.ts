import 'reflect-metadata';
import {
  Controller,
  Delete,
  ExecutionContext,
  Get,
  INestApplication,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Request } from 'express';
import { Server } from 'http';
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
import { ConversationOperationsService } from '../persistence/conversation-operations.service';
import { ConversationsRepository } from '../persistence/conversations.repository';
import { OwnershipContext, requireOwnership } from '../persistence/ownership-context';
import { RequestNonceStore } from '../persistence/request-nonce.store';
import {
  AuthorizedConversationOperations,
  conversationGrant,
  ConversationGrant,
} from './conversation-authorization.service';
import {
  ConversationHandlerBinding,
  ConversationHandlerRegistry,
  ConversationOperation,
  ConversationPolicy,
  conversationSpecifications,
  CONVERSATION_HANDLERS,
  CONVERSATION_POLICY,
} from './conversation-handler.policy';
import { ConversationAuthorizationModule } from './conversation-authorization.module';

const secret = 'fixture-only-jwt-secret';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const field = (name: string, value: string) =>
  hash(JSON.stringify(['workphelo.ai.request', 1, name, value]));
const key = (n: number) => {
  const bytes = Buffer.alloc(32, n);
  return { id: hash(bytes), key: bytes.toString('base64') };
};
const encryption = key(11),
  fingerprint = key(12),
  signing = key(13);
const env = () => ({
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_POLICY_VERSION: 'handler-test',
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
});
const id = 'abcdef01-1111-4111-8111-111111111111';
let capturedRequest: Request;

// Test-only policy fixtures; actual storage HTTP contracts have a separate controller suite.
@Controller('conversations')
class FixtureController {
  constructor(private readonly operations: AuthorizedConversationOperations) {}
  @Post() @ConversationPolicy('create') create(@Req() req: Request) {
    capturedRequest = req;
    return this.operations.create(conversationGrant(req, 'create'));
  }
  @Get() @ConversationPolicy('list') list(@Req() req: Request) {
    return this.operations.list(conversationGrant(req, 'list'));
  }
  @Get(':conversationId') @ConversationPolicy('read') read(@Req() req: Request) {
    return this.operations.read(conversationGrant(req, 'read'));
  }
  @Post(':conversationId/messages') @ConversationPolicy('append') append(@Req() req: Request) {
    return this.operations.append(conversationGrant(req, 'append'), 'fixture', 'fixture-key');
  }
  @Delete(':conversationId') @ConversationPolicy('delete') remove(@Req() req: Request) {
    return this.operations.delete(conversationGrant(req, 'delete'));
  }
  @Post('undeclared') @ConversationPolicy('create') undeclared() {
    throw new Error('Must not execute');
  }
}
const names = {
  create: 'create',
  list: 'list',
  read: 'read',
  append: 'append',
  delete: 'remove',
} as const;
const bindings: ConversationHandlerBinding[] = (Object.keys(names) as ConversationOperation[]).map(
  (operation) => ({
    controller: FixtureController,
    handler: FixtureController.prototype[names[operation]],
    operation,
    ...conversationSpecifications[operation],
  }),
);

function signed(
  method = 'POST',
  target = '/api/conversations',
  claims: Record<string, unknown> = {},
  changeProof: Record<string, unknown> = {},
) {
  const token = jwt.sign({ sub: 'user-a', tenantId: 'tenant-a', ...claims }, secret, {
    expiresIn: '15m',
  });
  const permissions = '[]';
  const assertion = jwt.sign(
    {
      user: {
        id: 'user-a',
        tenantId: 'tenant-a',
        role: 'TENANT_ADMIN',
        email: '',
        tenantSlug: 'a',
        tenantName: 'A',
        firstName: 'A',
        moduleConfig: {},
        featureConfig: {},
      },
      tokenHash: hash(token),
      permissionsHash: hash(permissions),
    },
    secret,
    { issuer: 'workphelo-gateway', audience: 'ai', expiresIn: 30 },
  );
  const [path, query = ''] = target.split('?');
  const iat = Math.floor(Date.now() / 1000);
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
      method,
      pathHash: field('path', path),
      queryHash: field('raw-query', query),
      bodyHash: hash(''),
      bodyLength: 0,
      contentType: '',
      tokenHash: hash(token),
      identityAssertionHash: hash(assertion),
      idempotencyKeyHash: field('idempotency-key', 'null'),
      ...changeProof,
    },
    Buffer.from(signing.key, 'base64'),
    {
      algorithm: 'HS256',
      header: { alg: 'HS256', typ: 'workphelo.ai.request+jwt', kid: signing.id },
    },
  );
  return {
    authorization: `Bearer ${token}`,
    'x-gateway-auth-context': assertion,
    'x-user-permissions': permissions,
    'x-ai-request-integrity': proof,
    'content-length': '0',
  };
}

async function harness(databaseUrl?: string, registered = bindings) {
  const original = process.env;
  process.env = { ...env(), ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) };
  const consume = jest.fn().mockResolvedValue(undefined);
  const owners: OwnershipContext[] = [];
  const observe = (owner: OwnershipContext) => {
    expect(consume).toHaveBeenCalled();
    owners.push(owner);
    return { id };
  };
  const repository = {
    create: jest.fn(observe),
    listOwned: jest.fn((owner: OwnershipContext) => [observe(owner)]),
    requireOwned: jest.fn(observe),
  };
  const operations = {
    readOwnedMessagePage: jest.fn((owner: OwnershipContext) => [observe(owner)]),
    appendUserMessage: jest.fn(observe),
    deleteOwned: jest.fn(observe),
  };
  try {
    const values: Record<string, unknown> = { ...parseRuntimeEnv(process.env) };
    let builder = Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true }), ConversationAuthorizationModule],
      controllers: [FixtureController],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (name: string) => values[name],
        getOrThrow: (name: string) => {
          if (values[name] === undefined) throw new Error('Missing fixture config');
          return values[name];
        },
        set: (name: string, value: unknown) => {
          values[name] = value;
        },
      })
      .overrideProvider(CONVERSATION_HANDLERS)
      .useValue(registered);
    if (!databaseUrl) {
      builder = builder
        .overrideProvider(AI_CLIENT_FACTORY)
        .useValue(() => ({ $connect: jest.fn(), $disconnect: jest.fn() }))
        .overrideProvider(RequestNonceStore)
        .useValue({ consume })
        .overrideProvider(ConversationsRepository)
        .useValue(repository)
        .overrideProvider(ConversationOperationsService)
        .useValue(operations);
    }
    const module = await builder.compile();
    const app = module.createNestApplication<INestApplication<Server>>({
      bodyParser: false,
      logger: false,
    });
    configureApplication(app, () => undefined, true);
    await app.init();
    return { app, consume, owners, repository, operations, config: app.get(ConfigService) };
  } finally {
    process.env = original;
  }
}

describe('Exact conversation handler authorization in the actual Nest pipeline', () => {
  let h: Awaited<ReturnType<typeof harness>>;
  beforeAll(async () => {
    h = await harness();
  });
  afterAll(async () => {
    await h?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const send = (method: string, target: string, headers = signed(method, target)) =>
    request(h.app.getHttpServer())[method.toLowerCase() as 'post'](target).set(headers);
  it.each(Object.keys(names) as ConversationOperation[])(
    'permits only the exact %s operation after consuming proof',
    async (operation) => {
      const spec = conversationSpecifications[operation];
      const target = spec.path.replace(':conversationId', id);
      const reply = await send(spec.method, target);
      expect(reply.status).toBe(operation === 'create' || operation === 'append' ? 201 : 200);
      expect(h.consume).toHaveBeenCalledTimes(1);
      expect(requireOwnership(h.owners.at(-1)!)).toEqual({
        tenantId: 'tenant-a',
        ownerUserId: 'user-a',
      });
      expect(reply.headers['cache-control']).toBe('no-store');
    },
  );
  it.each(['HEAD', 'OPTIONS', 'PUT'])(
    'rejects unsupported %s without consuming',
    async (method) => {
      expect((await send(method, '/api/conversations')).status).toBeGreaterThanOrEqual(400);
      expect(h.consume).not.toHaveBeenCalled();
    },
  );
  it.each([
    '/api/conversations/',
    '/api/Conversations',
    '/api/conversations/undeclared',
    `/api/conversations/${id.toUpperCase()}`,
  ])('rejects alias/undeclared %s before consumption', async (target) => {
    expect((await send('POST', target)).status).toBeGreaterThanOrEqual(400);
    expect(h.consume).not.toHaveBeenCalled();
  });
  it.each([
    'AI_CONVERSATION_HTTP_ENABLED',
    'AI_AUTHENTICATED_ROUTES_ENABLED',
    'AI_PERSISTENCE_ENABLED',
    'AI_MESSAGE_ENCRYPTION_ENABLED',
    'AI_MESSAGE_OPERATIONS_ENABLED',
    'AI_REQUEST_VERIFICATION_ENABLED',
  ])('fails closed when %s disabled', async (flag) => {
    h.config.set(flag, false);
    try {
      expect((await send('POST', '/api/conversations')).status).toBe(503);
      expect(h.consume).not.toHaveBeenCalled();
    } finally {
      h.config.set(flag, true);
    }
  });
  it.each(['authorization', 'x-gateway-auth-context', 'x-ai-request-integrity'])(
    'rejects missing %s before consuming',
    async (name) => {
      const headers: Record<string, string> = signed();
      delete headers[name];
      expect(
        (await send('POST', '/api/conversations', headers as ReturnType<typeof signed>)).status,
      ).toBe(401);
      expect(h.consume).not.toHaveBeenCalled();
    },
  );
  it.each([{ scope: 'careers' }, { type: 'refresh' }, { tenantId: 'foreign' }, { sub: 'foreign' }])(
    'rejects restricted/substituted identity %j',
    async (claims) => {
      expect(
        (await send('POST', '/api/conversations', signed('POST', '/api/conversations', claims)))
          .status,
      ).toBe(401);
      expect(h.consume).not.toHaveBeenCalled();
    },
  );
  it.each([
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { bodyHash: '0'.repeat(64) },
    { pathHash: '0'.repeat(64) },
    { deadlineAtMs: 1 },
  ])('rejects invalid proof %j', async (change) => {
    expect(
      (await send('POST', '/api/conversations', signed('POST', '/api/conversations', {}, change)))
        .status,
    ).toBe(401);
    expect(h.consume).not.toHaveBeenCalled();
  });
  it('rejects replay and nonce outage without business execution', async () => {
    for (const error of [new UnauthorizedException(), new ServiceUnavailableException()]) {
      h.consume.mockRejectedValueOnce(error);
      expect((await send('POST', '/api/conversations')).status).toBe(error.getStatus());
    }
    expect(h.repository.create).not.toHaveBeenCalled();
  });
  it('rechecks deadline after nonce acquisition before minting business authority', async () => {
    const realNow = Date.now.bind(Date);
    let offsetMs = 0;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offsetMs);
    h.consume.mockImplementationOnce(async () => {
      // Deterministic: jump the clock past the 5s deadline instead of sleeping.
      offsetMs = 6000;
    });
    try {
      expect((await send('POST', '/api/conversations')).status).toBe(504);
    } finally {
      clock.mockRestore();
    }
    expect(h.consume).toHaveBeenCalledTimes(1);
    expect(h.repository.create).not.toHaveBeenCalled();
  });
  it('cannot forge an operation capability or obtain one from raw request properties', () => {
    expect(() =>
      conversationGrant({ user: { id: 'a', tenantId: 'a' } } as unknown as Request, 'create'),
    ).toThrow();
    expect(() =>
      h.app.get(AuthorizedConversationOperations).create({} as ConversationGrant<'create'>),
    ).toThrow();
  });
  it('binds a capability to one operation and expires it before later execution', async () => {
    expect((await send('POST', '/api/conversations')).status).toBe(201);
    const grant = conversationGrant(capturedRequest, 'create');
    const facade = h.app.get(AuthorizedConversationOperations);
    expect(() => conversationGrant(capturedRequest, 'delete')).toThrow();
    expect(() => facade.delete(grant as unknown as ConversationGrant<'delete'>)).toThrow();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20000);
    try {
      expect(() => facade.create(grant)).toThrow('Gateway Timeout');
    } finally {
      clock.mockRestore();
    }
    expect(h.repository.create).toHaveBeenCalledTimes(1);
    expect(h.operations.deleteOwned).not.toHaveBeenCalled();
  });
  it('an empty registry authorizes no fixture handlers even when enabled', async () => {
    const production = await harness(undefined, []);
    try {
      expect(
        (await request(production.app.getHttpServer()).post('/api/conversations').set(signed()))
          .status,
      ).toBe(403);
      expect(production.consume).not.toHaveBeenCalled();
    } finally {
      await production.app.close();
    }
  });
  it('preserves exact probes and eligibility without consuming nonces', async () => {
    expect((await request(h.app.getHttpServer()).get('/api/health')).status).toBe(200);
    const ready = await request(h.app.getHttpServer()).get('/api/ready');
    expect((ready.body as { inferenceAvailable: boolean }).inferenceAvailable).toBe(false);
    const eligibility = await request(h.app.getHttpServer())
      .get('/api/eligibility')
      .set(signed('GET', '/api/conversations'));
    expect(eligibility.status).toBe(200);
    expect(h.consume).not.toHaveBeenCalled();
  });
});

describe('Registry identity and metadata are independent requirements', () => {
  function context(binding = bindings[0], extra: Record<string, unknown> = {}) {
    return {
      getClass: () => binding.controller,
      getHandler: () => binding.handler,
      switchToHttp: () => ({
        getRequest: () => ({
          method: binding.method,
          originalUrl: binding.path,
          route: { path: binding.path },
        }),
      }),
      ...extra,
    } as unknown as ExecutionContext;
  }
  it('empty production registry authorizes no handlers', () => {
    expect(() => new ConversationHandlerRegistry([]).match(context())).toThrow();
  });
  it.each(['controller', 'handler'] as const)('rejects unknown %s', (field) => {
    expect(() =>
      new ConversationHandlerRegistry(bindings).match(
        context(bindings[0], {
          [field === 'controller' ? 'getClass' : 'getHandler']: () => class Unknown {},
        }),
      ),
    ).toThrow();
  });
  it.each([undefined, 'delete'])('rejects missing/mismatched metadata %s', (value) => {
    const fn = bindings[0].handler;
    const old: unknown = Reflect.getOwnMetadata(CONVERSATION_POLICY, fn);
    Reflect.defineMetadata(CONVERSATION_POLICY, value, fn);
    try {
      expect(() => new ConversationHandlerRegistry(bindings).match(context())).toThrow();
    } finally {
      Reflect.defineMetadata(CONVERSATION_POLICY, old, fn);
    }
  });
  it('rejects decorator-only and conflicting registry declarations', () => {
    expect(() => new ConversationHandlerRegistry([]).match(context())).toThrow();
    expect(() =>
      new ConversationHandlerRegistry([bindings[0], bindings[0]]).match(context()),
    ).toThrow();
    expect(() =>
      new ConversationHandlerRegistry([{ ...bindings[0], operation: 'delete' }]).match(context()),
    ).toThrow();
  });
});

describe('Registry target restrictions', () => {
  it.each(['POST', 'HEAD', 'OPTIONS'])('rejects list handler method mismatch %s', (method) => {
    const binding = bindings.find((b) => b.operation === 'list')!;
    const context = {
      getClass: () => binding.controller,
      getHandler: () => binding.handler,
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          originalUrl: '/api/conversations',
          route: { path: '/api/conversations' },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => new ConversationHandlerRegistry(bindings).match(context)).toThrow();
  });
  it.each([
    `/api/conversations/${id}/`,
    `/api/conversations/${id.toUpperCase()}`,
    `/api/conversations/%31${id.slice(1)}`,
    `/api/conversations//${id}`,
  ])('rejects noncanonical target %s', (target) => {
    const binding = bindings.find((b) => b.operation === 'read')!;
    const context = {
      getClass: () => binding.controller,
      getHandler: () => binding.handler,
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: target, route: { path: binding.path } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => new ConversationHandlerRegistry(bindings).match(context)).toThrow();
  });
});

describe('Conversation HTTP configuration', () => {
  it('defaults off independently of eligibility', () => {
    expect(
      parseRuntimeEnv({ NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'test' })
        .AI_CONVERSATION_HTTP_ENABLED,
    ).toBe(false);
  });
  it.each([
    'AI_AUTHENTICATED_ROUTES_ENABLED',
    'AI_PERSISTENCE_ENABLED',
    'AI_MESSAGE_ENCRYPTION_ENABLED',
    'AI_MESSAGE_OPERATIONS_ENABLED',
    'AI_REQUEST_VERIFICATION_ENABLED',
  ])('requires %s', (flag) => {
    expect(() => parseRuntimeEnv({ ...env(), [flag]: 'false' })).toThrow();
  });
  it.each([
    'JWT_SECRET',
    'DATABASE_URL',
    'AI_MESSAGE_ENCRYPTION_KEYS',
    'AI_FINGERPRINT_KEYS',
    'AI_REQUEST_VERIFICATION_KEYS',
  ])('requires valid %s', (name) => {
    expect(() => parseRuntimeEnv({ ...env(), [name]: undefined })).toThrow();
  });
  it('accepts complete independent keys without enabling inference', () => {
    const config = parseRuntimeEnv(env());
    expect(config.AI_CONVERSATION_HTTP_ENABLED).toBe(true);
    expect(config.AI_ENABLED).toBe(false);
    expect(config.AI_MOCK_ENABLED).toBe(false);
  });
});

const testUrl = process.env.AI_TEST_DATABASE_URL;
(testUrl ? describe : describe.skip)('Authorized handlers with real disposable PostgreSQL', () => {
  let h: Awaited<ReturnType<typeof harness>>;
  let db: ReturnType<typeof createAiClient>;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/workphelo_ai_2b1' ||
      url.searchParams.get('schema') !== 'ai'
    )
      throw new Error('Only disposable AI database allowed');
    h = await harness(testUrl);
    db = createAiClient(testUrl!);
    await db.$connect();
  });
  afterAll(async () => {
    await h?.app.close();
    await db?.$disconnect();
  });
  it('consumes before durable creation and rejects replay after success', async () => {
    const headers = signed();
    const first = await request(h.app.getHttpServer()).post('/api/conversations').set(headers);
    expect(first.status).toBe(201);
    expect(
      await db.aiConversation.findUnique({ where: { id: (first.body as { id: string }).id } }),
    ).not.toBeNull();
    expect(
      (await request(h.app.getHttpServer()).post('/api/conversations').set(headers)).status,
    ).toBe(401);
  });
  it.each(['foreign-tenant', 'foreign-owner', 'expired', 'deleted'])(
    'conceals %s records even from tenant admin',
    async (kind) => {
      const row = await db.aiConversation.create({
        data: {
          tenantId: kind === 'foreign-tenant' ? 'other' : 'tenant-a',
          ownerUserId: kind === 'foreign-owner' ? 'other' : 'user-a',
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() + (kind === 'expired' ? -1000 : 60000)),
        },
      });
      if (kind === 'deleted') await db.aiConversation.delete({ where: { id: row.id } });
      const target = `/api/conversations/${row.id}`;
      expect(
        (await request(h.app.getHttpServer()).get(target).set(signed('GET', target))).status,
      ).toBe(404);
      const append = target + '/messages';
      expect(
        (await request(h.app.getHttpServer()).post(append).set(signed('POST', append))).status,
      ).toBe(404);
      expect(
        (await request(h.app.getHttpServer()).delete(target).set(signed('DELETE', target))).status,
      ).toBe(404);
    },
  );
  it('keeps a proof spent after transactional business failure', async () => {
    const target = `/api/conversations/${randomUUID()}/messages`;
    const headers = signed('POST', target);
    expect((await request(h.app.getHttpServer()).post(target).set(headers)).status).toBe(404);
    expect((await request(h.app.getHttpServer()).post(target).set(headers)).status).toBe(401);
    expect(
      (await request(h.app.getHttpServer()).post(target).set(signed('POST', target))).status,
    ).toBe(404);
  });
  it('supports owned encrypted append, bounded read and deletion through exact handlers', async () => {
    const created = await request(h.app.getHttpServer()).post('/api/conversations').set(signed());
    expect(created.status).toBe(201);
    const target = `/api/conversations/${(created.body as { id: string }).id}`;
    const append = target + '/messages';
    expect(
      (await request(h.app.getHttpServer()).post(append).set(signed('POST', append))).status,
    ).toBe(201);
    const page = await request(h.app.getHttpServer()).get(target).set(signed('GET', target));
    expect(page.status).toBe(200);
    expect(
      (page.body as { messages: { items: { content: string }[] } }).messages.items[0].content,
    ).toBe('fixture');
    expect(
      (await request(h.app.getHttpServer()).delete(target).set(signed('DELETE', target))).status,
    ).toBe(200);
    expect(
      (await request(h.app.getHttpServer()).get(target).set(signed('GET', target))).status,
    ).toBe(404);
  });
  it('does not enter business execution with an expired signed transaction budget', async () => {
    const execute = jest.fn(() => Promise.resolve(undefined));
    await expect(
      h.app.get(AiDatabaseService).transaction(execute, Date.now() - 1),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
