import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import {
  OperationObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import { setupSwagger } from './swagger.config';
import { ProxyController } from './proxy/proxy.controller';
import { AiRateAdmission } from './proxy/ai-rate-admission';
import { aiConversationJsonBoundary } from './proxy/ai-conversation-body';
import { PRODUCT_GUIDANCE_CATALOG } from '../../ai-service/src/inference/demo-guidance';
import { AI_DEMO_QUESTIONS } from './ai.openapi';
import { isSwaggerEnabled } from '@work-phelo/config';

const root = '/api/v1/ai';
const expected = [
  `get ${root}/eligibility`,
  `post ${root}/conversations`,
  `get ${root}/conversations`,
  `get ${root}/conversations/{id}`,
  `post ${root}/conversations/{id}/messages`,
  `delete ${root}/conversations/{id}`,
];
const errorStatuses = [400, 401, 403, 404, 409, 413, 415, 429, 503, 504];
describe('Generated Gateway AI OpenAPI contract', () => {
  let app: INestApplication, origin: string, document: OpenAPIObject;
  const original = process.env;
  const admit = jest.fn();
  beforeAll(async () => {
    process.env = {
      NODE_ENV: 'test',
      ENABLE_SWAGGER: 'true',
      JWT_SECRET: 'openapi-private-key-canary',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
      AI_REQUEST_SIGNING_ENABLED: 'false',
    };
    const module = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [{ provide: AiRateAdmission, useValue: { admit } }],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    app.use(cookieParser());
    app.use(aiConversationJsonBoundary());
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      setupSwagger(app);
    } finally {
      log.mockRestore();
    }
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    const result = await fetch(origin + '/docs-json', {
      headers: { Connection: 'close' },
    });
    expect(result.status).toBe(200);
    document = (await result.json()) as OpenAPIObject;
  });
  afterAll(async () => {
    await app?.close();
    process.env = original;
  });
  const schema = (name: string) =>
    document.components!.schemas![name] as SchemaObject;
  const operation = (method: string, path: string) =>
    (document.paths[path] as Record<string, OperationObject>)[method];

  it('serves the existing /docs UI and /docs-json with exactly six concrete AI operations', async () => {
    expect(
      (await fetch(origin + '/docs', { headers: { Connection: 'close' } }))
        .status,
    ).toBe(200);
    const initializer = await fetch(origin + '/docs/swagger-ui-init.js', {
      headers: { Connection: 'close' },
    });
    expect(initializer.status).toBe(200);
    expect(await initializer.text()).toContain('AI Assistant');
    const actual = Object.entries(document.paths)
      .filter(([path]) => path.startsWith(root + '/'))
      .flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method} ${path}`),
      );
    expect(actual.sort()).toEqual([...expected].sort());
    expect(document.openapi).toBe('3.0.0');
  });
  it('matches actual AI method/path declarations behind the wildcard Gateway route', () => {
    const policy = readFileSync(
      join(
        __dirname,
        '../../ai-service/src/security/conversation-handler.policy.ts',
      ),
      'utf8',
    );
    const actual = [
      ...policy.matchAll(/method: '(GET|POST|DELETE)',\s*path: '([^']+)'/g),
    ].map(
      (match) =>
        `${match[1].toLowerCase()} ${match[2].replace('/api/', root + '/').replace(':conversationId', '{id}')}`,
    );
    expect([...actual, `get ${root}/eligibility`].sort()).toEqual(
      [...expected].sort(),
    );
  });
  it('serves an AI-only document from the same six operations and component definitions', async () => {
    const response = await fetch(origin + root + '/docs-json', {
      headers: { Connection: 'close' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const scoped = (await response.json()) as OpenAPIObject;
    expect(scoped.openapi).toBe(document.openapi);
    expect(scoped.info.title).toBe('WorkPhelo AI Assistant');
    expect(scoped.servers).toEqual([{ url: '/' }]);
    expect(
      Object.entries(scoped.paths)
        .flatMap(([path, item]) =>
          Object.keys(item).map((method) => `${method} ${path}`),
        )
        .sort(),
    ).toEqual([...expected].sort());
    for (const [path, item] of Object.entries(scoped.paths))
      expect(item).toEqual(document.paths[path]);
    for (const [name, definition] of Object.entries(
      scoped.components!.schemas!,
    ))
      expect(definition).toEqual(document.components!.schemas![name]);
    expect(scoped.components!.securitySchemes).toEqual(
      document.components!.securitySchemes,
    );
    const serialized = JSON.stringify(scoped);
    for (const match of serialized.matchAll(
      /"\$ref":"#\/components\/schemas\/([^"/]+)"/g,
    ))
      expect(scoped.components!.schemas![match[1]]).toBeDefined();
    for (const internal of [
      'x-ai-request-integrity',
      'x-gateway-auth-context',
      'demoIntent',
      '/api/health',
      '/api/ready',
    ])
      expect(serialized).not.toContain(internal);
  });
  it.each(['/docs', '/docs/'])(
    'loads dedicated UI, relative assets and its JSON URL from %s while execution is off',
    async (suffix) => {
      const uiUrl = origin + root + suffix;
      const response = await fetch(uiUrl, { headers: { Connection: 'close' } });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      const html = await response.text();
      const assets = [
        ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
      ].map((match) => new URL(match[1], uiUrl));
      expect(assets.length).toBeGreaterThanOrEqual(4);
      let initializer = '';
      for (const asset of assets) {
        expect(asset.origin).toBe(origin);
        expect(asset.pathname).toMatch(/^\/api\/v1\/ai\/docs\//);
        const resource = await fetch(asset, {
          headers: { Connection: 'close' },
        });
        expect(resource.status).toBe(200);
        expect(resource.headers.get('content-type')).toMatch(/javascript|css/);
        const content = await resource.text();
        if (asset.pathname.endsWith('swagger-ui-init.js'))
          initializer = content;
      }
      expect(initializer).toContain('"url": "/api/v1/ai/docs-json"');
      expect(initializer).toContain('WorkPhelo AI Assistant');
      expect(process.env.AI_REQUEST_SIGNING_ENABLED).toBe('false');
      expect(process.env.AI_INTERNAL_DEMO_ENABLED).toBeUndefined();
      expect(admit).not.toHaveBeenCalled();
    },
  );
  it('does not mount dedicated documentation when the existing Swagger policy disables it', async () => {
    const previous = process.env.ENABLE_SWAGGER;
    process.env.ENABLE_SWAGGER = 'false';
    const module = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [{ provide: AiRateAdmission, useValue: { admit } }],
    }).compile();
    const disabled = module.createNestApplication({ logger: false });
    try {
      if (isSwaggerEnabled()) setupSwagger(disabled);
      await disabled.listen(0, '127.0.0.1');
      for (const path of [root + '/docs', root + '/docs-json']) {
        const result = await fetch((await disabled.getUrl()) + path, {
          headers: { Connection: 'close' },
        });
        expect(result.status).toBe(401);
        await result.text();
      }
      const rootDocs = await fetch((await disabled.getUrl()) + '/docs', {
        headers: { Connection: 'close' },
      });
      expect(rootDocs.status).toBe(404);
      await rootDocs.text();
    } finally {
      await disabled.close();
      process.env.ENABLE_SWAGGER = previous;
    }
  });
  it('uses the existing Bearer OR session-cookie schemes on every AI operation', () => {
    expect(document.components!.securitySchemes!['access-token']).toMatchObject(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    );
    expect(document.components!.securitySchemes!.cookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    });
    for (const item of expected) {
      const [method, path] = item.split(' ');
      expect(operation(method, path).security).toEqual([
        { 'access-token': [] },
        { cookie: [] },
      ]);
      expect(operation(method, path).description).toContain(
        'restricted/careers',
      );
      expect(operation(method, path).description).toContain('NOT a real LLM');
    }
  });
  it('documents idempotency only for create/append and conditional Origin for cookie mutations', () => {
    for (const item of expected) {
      const [method, path] = item.split(' '),
        op = operation(method, path);
      const parameters = op.parameters as {
        name: string;
        in: string;
        required?: boolean;
        schema?: SchemaObject;
      }[];
      const key = parameters.find(
        (parameter) => parameter.name === 'Idempotency-Key',
      );
      if (method === 'post')
        expect(key).toMatchObject({
          in: 'header',
          required: true,
          schema: { minLength: 1, maxLength: 128 },
        });
      else expect(key).toBeUndefined();
      if (['post', 'delete'].includes(method))
        expect(
          parameters.find((parameter) => parameter.name === 'Origin'),
        ).toMatchObject({ in: 'header', required: false });
    }
  });
  it('defines closed request DTOs, strict catalog and the two distinct append responses', () => {
    expect(schema('AiCreateConversationRequest')).toMatchObject({
      type: 'object',
      additionalProperties: false,
      maxProperties: 0,
      example: {},
    });
    expect(schema('AiAppendMessageRequest')).toMatchObject({
      required: ['content'],
      additionalProperties: false,
      properties: {
        content: {
          type: 'string',
          minLength: 1,
          'x-max-utf8-bytes': 16384,
          description:
            'New submissions require an exact catalog question. Committed retries require the original content.',
        },
      },
    });
    expect(schema('AiDemoAppendMessageRequest')).toMatchObject({
      required: ['content'],
      properties: { content: { $ref: '#/components/schemas/AiDemoQuestion' } },
    });
    expect(schema('AiDemoQuestion').enum).toEqual([...AI_DEMO_QUESTIONS]);
    expect(AI_DEMO_QUESTIONS).toEqual(
      PRODUCT_GUIDANCE_CATALOG.entries.map(({ question }) => question),
    );
    const response = operation('post', root + '/conversations/{id}/messages')
      .responses['201'];
    expect(response).toMatchObject({
      content: {
        'application/json': {
          schema: {
            oneOf: [
              { $ref: '#/components/schemas/AiDemoTurn' },
              { $ref: '#/components/schemas/AiUserMessageMetadata' },
            ],
          },
        },
      },
    });
    expect(schema('AiDemoTurn')).toMatchObject({
      required: [
        'id',
        'conversationId',
        'sequence',
        'role',
        'createdAt',
        'demo',
      ],
      additionalProperties: false,
    });
    expect(schema('AiDemoReply').properties!.role).toEqual({
      type: 'string',
      enum: ['DEMO_ASSISTANT'],
    });
  });
  it('makes demo eligibility optional and always reports real inference unavailable', () => {
    expect(schema('AiEligibility').required).toEqual([
      'eligible',
      'inferenceAvailable',
    ]);
    expect(schema('AiEligibility').properties!.inferenceAvailable).toEqual({
      type: 'boolean',
      enum: [false],
    });
    expect(schema('AiEligibility').properties!.demo).toEqual({
      $ref: '#/components/schemas/AiDemoConfiguration',
    });
    expect(schema('AiDemoConfiguration').required).toEqual([
      'configured',
      'mode',
      'disclaimer',
      'questions',
    ]);
    expect(schema('AiDemoConfiguration').properties!.questions).toMatchObject({
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: { $ref: '#/components/schemas/AiDemoQuestion' },
    });
  });
  it('documents both message roles, ordered history and nullable opaque pagination', () => {
    expect(schema('AiMessageRole').enum).toEqual(['USER', 'DEMO_ASSISTANT']);
    const prisma = readFileSync(
      join(__dirname, '../../ai-service/prisma/schema.prisma'),
      'utf8',
    );
    const body = /enum AiMessageRole \{([\s\S]*?)\}/.exec(prisma)![1];
    expect(
      body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[A-Z_]+$/.test(line)),
    ).toEqual(schema('AiMessageRole').enum);
    expect(schema('AiConversationList').properties!.nextCursor).toMatchObject({
      type: 'string',
      nullable: true,
      maxLength: 256,
    });
    expect(schema('AiMessage').properties!.role).toEqual({
      $ref: '#/components/schemas/AiMessageRole',
    });
    const parameters = operation(
      'get',
      root + '/conversations/{id}',
    ).parameters;
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        }),
        expect.objectContaining({ name: 'cursor' }),
      ]),
    );
    const properties = schema('AiConversation').properties as Record<
      string,
      SchemaObject
    >;
    expect(
      Date.parse(properties.expiresAt.example as string) -
        Date.parse(properties.createdAt.example as string),
    ).toBe(720 * 3600000);
  });
  it('documents actual success codes, no delete body, sanitized errors and bounded Retry-After', () => {
    for (const item of expected) {
      const [method, path] = item.split(' '),
        op = operation(method, path);
      expect(
        op.responses[
          method === 'post' ? '201' : method === 'delete' ? '204' : '200'
        ],
      ).toBeDefined();
      for (const status of [400, 401, 403, 429, 503, 504])
        expect(op.responses[status]).toBeDefined();
      for (const status of Object.keys(op.responses).filter(
        (value) => Number(value) >= 400,
      ))
        expect(errorStatuses).toContain(Number(status));
      expect(op.responses['429']).toMatchObject({
        headers: {
          'Retry-After': {
            schema: { type: 'integer', minimum: 1, maximum: 60 },
          },
        },
      });
    }
    const remove = operation('delete', root + '/conversations/{id}');
    expect(remove.requestBody).toBeUndefined();
    expect(remove.responses['204']).not.toHaveProperty('content');
    expect(schema('AiSanitizedError').required).toEqual([
      'statusCode',
      'code',
      'message',
      'requestId',
    ]);
    expect(schema('AiGatewayError').required).toEqual([
      'statusCode',
      'message',
    ]);
  });
  it('resolves all schema references and exposes no internal operations or proof parameters', () => {
    const content = JSON.stringify(document);
    for (const match of content.matchAll(
      /"\$ref":"#\/components\/schemas\/([^"/]+)"/g,
    ))
      expect(document.components!.schemas![match[1]]).toBeDefined();
    for (const secret of [
      'openapi-private-key-canary',
      'x-ai-request-integrity',
      'x-gateway-auth-context',
      'demoIntent',
      'AI_REQUEST_SIGNING_KEY',
      'JWT_SECRET',
    ])
      expect(content).not.toContain(secret);
    for (const path of [
      '/api/health',
      '/api/ready',
      root + '/health',
      root + '/ready',
      root + '/inference',
    ])
      expect(document.paths[path]).toBeUndefined();
  });
  it('does not register public AI handlers, bypass authentication or enable execution', async () => {
    const eligibility = await fetch(origin + root + '/eligibility', {
      headers: { Connection: 'close' },
    });
    expect(eligibility.status).toBe(401);
    const create = await fetch(origin + root + '/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Connection: 'close' },
      body: '{}',
    });
    expect(create.status).toBe(503);
    expect(admit).not.toHaveBeenCalled();
    expect(process.env.AI_INTERNAL_DEMO_ENABLED).toBeUndefined();
    expect(process.env.AI_CONVERSATION_HTTP_ENABLED).toBeUndefined();
    const router = app.getHttpAdapter().getInstance() as {
      _router: { stack: { route?: { path: string } }[] };
    };
    const routes = router._router.stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => Boolean(path?.startsWith('/api/v1')));
    expect(routes.filter((path) => path === '/api/v1/*')).toHaveLength(1);
    expect(
      routes.every(
        (path) => path === '/api/v1/*' || path.startsWith(root + '/docs'),
      ),
    ).toBe(true);
  });
});
