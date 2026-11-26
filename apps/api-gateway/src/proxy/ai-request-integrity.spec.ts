import { createHash, createSecretKey } from 'crypto';
import * as http from 'http';
import * as jwt from 'jsonwebtoken';
import {
  AI_INTEGRITY_HEADER,
  AI_INTEGRITY_TYPE,
  AiForwardingDescriptor,
  AiForwardingInput,
  AiRequestIntegritySigner,
  buildAiForwardingDescriptor,
  openSignedAiRequest,
  parseAiSigningConfig,
  selectAiAccessCredential,
  SignedAiForwardingDescriptor,
} from './ai-request-integrity';
import { assertGatewayRuntimeEnv } from '../config/runtime-env';

// Test-only fixture material. Never used as a runtime default.
const material = Buffer.alloc(32, 81);
const keyId = createHash('sha256').update(material).digest('hex');
const env = {
  NODE_ENV: 'test',
  AI_REQUEST_SIGNING_ENABLED: 'true',
  AI_REQUEST_SIGNING_KEY_ID: keyId,
  AI_REQUEST_SIGNING_KEY: material.toString('base64'),
};
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const fieldHash = (field: string, value: string) =>
  hash(JSON.stringify(['workphelo.ai.request', 1, field, value]));
const id = '11111111-1111-4111-8111-111111111111';
function input(extra: Partial<AiForwardingInput> = {}): AiForwardingInput {
  return {
    method: 'POST',
    externalTarget: `/api/v1/ai/conversations/${id}/messages`,
    headers: {
      authorization: 'Bearer access-token-fixture',
      'content-type': 'application/json',
      'idempotency-key': 'fixture-key',
    },
    body: { content: ' exact 🌍 \n' },
    identityAssertion: 'signed-identity-fixture',
    permissions: '[]',
    permissionsSignature: 'a'.repeat(64),
    deadlineAtMs: Date.now() + 5000,
    ...extra,
  };
}

describe('AI signing configuration and boundary validation (unit fixtures)', () => {
  it('defaults off without keys or an AI URL, ignoring unused key material', () => {
    expect(
      parseAiSigningConfig({ AI_REQUEST_SIGNING_KEY: 'unused-invalid' }),
    ).toEqual({ enabled: false });
    expect(() =>
      new AiRequestIntegritySigner(parseAiSigningConfig({})).seal(
        buildAiForwardingDescriptor(input()),
      ),
    ).toThrow('AI request integrity unavailable or invalid');
  });
  it('validates key objects at construction and independently blocks a production signing process', () => {
    expect(
      () =>
        new AiRequestIntegritySigner({
          enabled: true,
          keyId,
          key: createSecretKey(Buffer.alloc(16)),
        }),
    ).toThrow('AI request integrity unavailable or invalid');
    expect(
      () =>
        new AiRequestIntegritySigner({
          enabled: true,
          keyId: 'f'.repeat(64),
          key: createSecretKey(material),
        }),
    ).toThrow('AI request integrity unavailable or invalid');
    const signer = new AiRequestIntegritySigner(parseAiSigningConfig(env));
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => signer.seal(buildAiForwardingDescriptor(input()))).toThrow(
        'AI request integrity unavailable or invalid',
      );
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
  it.each([
    { AI_REQUEST_SIGNING_ENABLED: 'TRUE' },
    { AI_REQUEST_SIGNING_ENABLED: true },
    { AI_REQUEST_SIGNING_KEY: undefined },
    { AI_REQUEST_SIGNING_KEY: 'private-invalid-key-canary' },
    { AI_REQUEST_SIGNING_KEY_ID: 'unknown' },
    { AI_REQUEST_SIGNING_KEY_ID: 'f'.repeat(64) },
    { NODE_ENV: 'production' },
    { NODE_ENV: undefined },
    { JWT_SECRET: material.toString('base64') },
    { FIELD_ENCRYPTION_KEY: material.toString('hex') },
    {
      AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([
        { key: material.toString('base64') },
      ]),
    },
    {
      AI_FINGERPRINT_KEYS: JSON.stringify([
        { key: material.toString('base64') },
      ]),
    },
  ])(
    'rejects enabled invalid or reused signing keys without exposing values',
    (extra) => {
      expect(() => parseAiSigningConfig({ ...env, ...extra })).toThrow(
        'AI request integrity unavailable or invalid',
      );
      try {
        parseAiSigningConfig({ ...env, ...extra });
      } catch (error) {
        expect(String(error)).not.toContain('canary');
        expect(String(error)).not.toContain(material.toString('base64'));
      }
    },
  );
  it('fails closed for the signer without coupling ordinary Gateway startup to optional AI keys', () => {
    const original = process.env;
    process.env = {
      ...env,
      JWT_SECRET: 'jwt-only',
      AUTH_SERVICE_URL: 'http://auth.test',
      HR_SERVICE_URL: 'http://hr.test',
      NOTIFICATION_SERVICE_URL: 'http://notify.test',
    };
    try {
      expect(() => assertGatewayRuntimeEnv()).not.toThrow();
      delete process.env.AI_REQUEST_SIGNING_KEY;
      expect(() => assertGatewayRuntimeEnv()).not.toThrow();
      expect(() => parseAiSigningConfig(process.env)).toThrow(
        'AI request integrity unavailable or invalid',
      );
    } finally {
      process.env = original;
    }
  });
  it.each([
    '/api/v1/ai//conversations',
    '/api/v1/ai/conversations/',
    '/api/v1/ai/./conversations',
    '/api/v1/ai/x/../conversations',
    '/api/v1/ai/%63onversations',
    '/api/v1/ai/conversations%2fother',
    '/api/v1/ai/conversations/%252f',
    '/api/v1/ai/conversations/%zz',
    `/api/v1/ai/conversations/${id.toUpperCase().replace('11111111', 'ABCDEF12')}`,
    '/api/v1/ai/conversations/not-a-uuid',
    '/api/v1/ai/eligibility',
    '/api/v1/hr/employees',
  ])(
    'rejects ambiguous/unsupported target %s rather than normalizing it',
    (externalTarget) => {
      expect(() =>
        buildAiForwardingDescriptor(input({ externalTarget })),
      ).toThrow('AI request integrity unavailable or invalid');
    },
  );
  it.each([
    'limit=1&limit=2',
    'tenantId=foreign',
    'limit=01',
    'limit=101',
    'cursor=a&',
    'cursor=%zz',
    'cursor=%252f',
    'cursor=a%26b%3D2',
    'cursor=a=b',
    '%6cimit=2',
    'limit=2?cursor=x',
  ])('rejects ambiguous query %s', (query) => {
    expect(() =>
      buildAiForwardingDescriptor(
        input({
          method: 'GET',
          body: undefined,
          externalTarget: `/api/v1/ai/conversations?${query}`,
        }),
      ),
    ).toThrow('AI request integrity unavailable or invalid');
  });
  it.each([
    'multipart/form-data; boundary=x',
    'application/x-www-form-urlencoded',
    'text/plain',
  ])('rejects %s', (type) => {
    expect(() =>
      buildAiForwardingDescriptor(
        input({
          headers: { authorization: 'Bearer token', 'content-type': type },
        }),
      ),
    ).toThrow('AI request integrity unavailable or invalid');
  });
  it('rejects compression, transfer encoding and ambiguous or duplicate framing', () => {
    for (const headers of [
      { 'content-encoding': 'gzip' },
      { 'transfer-encoding': 'chunked' },
      { 'content-length': '2, 3' },
    ])
      expect(() =>
        buildAiForwardingDescriptor(
          input({ headers: { ...input().headers, ...headers } }),
        ),
      ).toThrow();
    expect(() =>
      buildAiForwardingDescriptor(
        input({ rawHeaders: ['Content-Length', '2', 'content-length', '2'] }),
      ),
    ).toThrow();
  });
  it('rejects oversized serialized bodies and bodies on GET/DELETE', () => {
    expect(() =>
      buildAiForwardingDescriptor(
        input({ body: { content: 'x'.repeat(32768) } }),
      ),
    ).toThrow();
    for (const method of ['GET', 'DELETE'])
      expect(() =>
        buildAiForwardingDescriptor(
          input({ method, externalTarget: `/api/v1/ai/conversations/${id}` }),
        ),
      ).toThrow();
  });
  it('rejects bad idempotency headers, unsupported verbs and invalid deadlines', () => {
    expect(() =>
      buildAiForwardingDescriptor(
        input({
          headers: { ...input().headers, 'idempotency-key': 'bad key' },
        }),
      ),
    ).toThrow();
    expect(() =>
      buildAiForwardingDescriptor(input({ method: 'post' })),
    ).toThrow();
    for (const deadlineAtMs of [0, NaN, Date.now() + 60000])
      expect(() =>
        buildAiForwardingDescriptor(input({ deadlineAtMs })),
      ).toThrow();
  });
  it('rejects forged opaque descriptors', () => {
    const signer = new AiRequestIntegritySigner(parseAiSigningConfig(env));
    expect(() => signer.seal({} as AiForwardingDescriptor)).toThrow();
    expect(() =>
      openSignedAiRequest(
        {} as SignedAiForwardingDescriptor,
        'http://127.0.0.1',
        () => undefined,
        () => undefined,
      ),
    ).toThrow();
  });
  it('selects a canonical credential and rejects conflicting/ambiguous representations', () => {
    expect(
      selectAiAccessCredential({
        headers: {},
        cookies: { access_token: 'cookie-token' },
      }),
    ).toBe('cookie-token');
    expect(
      selectAiAccessCredential({
        headers: { authorization: 'bearer same' },
        cookies: { access_token: 'same' },
      }),
    ).toBe('same');
    for (const value of [
      {
        headers: { authorization: 'Bearer a' },
        cookies: { access_token: 'b' },
      },
      { headers: { authorization: ['Bearer a', 'Bearer b'] } },
      { headers: { cookie: 'access_token=a; access_token=b' } },
      {
        headers: { authorization: 'Bearer a', cookie: 'access_token=b' },
        cookies: {},
      },
      { headers: { authorization: 'Bearer a' }, cookies: { access_token: '' } },
    ])
      expect(() =>
        selectAiAccessCredential(
          value as unknown as Parameters<typeof selectAiAccessCredential>[0],
        ),
      ).toThrow();
  });
});

interface Captured {
  method: string;
  target: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}
describe('Signed immutable descriptor to actual local HTTP bytes (test-only downstream)', () => {
  let server: http.Server, origin: string;
  const pending: ((captured: Captured) => void)[] = [];
  const signer = new AiRequestIntegritySigner(parseAiSigningConfig(env));
  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const captured = {
          method: request.method!,
          target: request.url!,
          headers: request.headers,
          body: Buffer.concat(chunks),
        };
        response.end('ok');
        pending.shift()!(captured);
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No disposable listener');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  function capture(descriptor: AiForwardingDescriptor) {
    return captureSigned(signer.seal(descriptor));
  }
  function captureSigned(signed: SignedAiForwardingDescriptor) {
    return new Promise<Captured>((resolve, reject) => {
      pending.push(resolve);
      openSignedAiRequest(
        signed,
        origin,
        (response) => response.resume(),
        reject,
      ).send();
    });
  }
  function claims(captured: Captured) {
    const proof = captured.headers[AI_INTEGRITY_HEADER];
    if (typeof proof !== 'string') throw new Error('Missing proof');
    return jwt.verify(proof, createSecretKey(material), {
      algorithms: ['HS256'],
      issuer: 'workphelo-gateway',
      audience: 'workphelo-ai-request',
      maxAge: '10s',
    }) as jwt.JwtPayload;
  }
  it('forwards the single final JSON serialization with exact Unicode, whitespace, content type and byte length', async () => {
    const original = '{ "content" : "  🌍\\n  " }';
    const parsed: unknown = JSON.parse(original);
    const captured = await capture(
      buildAiForwardingDescriptor(
        input({
          body: parsed,
          headers: {
            ...input().headers,
            'content-length': String(Buffer.byteLength(original)),
          },
        }),
      ),
    );
    expect(captured.body.toString()).toBe(JSON.stringify(parsed));
    expect(captured.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(captured.headers['content-length']).toBe(
      String(captured.body.length),
    );
    const proof = claims(captured);
    expect(proof).toMatchObject({
      v: 1,
      method: captured.method,
      bodyHash: hash(captured.body),
      bodyLength: captured.body.length,
      contentType: captured.headers['content-type'],
      pathHash: fieldHash('path', `/api/conversations/${id}/messages`),
      queryHash: fieldHash('raw-query', ''),
    });
  });
  it('snapshots body and headers before signing; later caller mutation cannot alter transmission', async () => {
    const request = input();
    const descriptor = buildAiForwardingDescriptor(request);
    const signed = signer.seal(descriptor);
    const body = request.body as { content: string };
    body.content = 'mutated-private-canary';
    request.headers['idempotency-key'] = 'changed';
    const captured = await captureSigned(signed);
    expect(captured.body.toString()).not.toContain('mutated-private-canary');
    expect(captured.headers['idempotency-key']).toBe('fixture-key');
    expect(Object.keys(descriptor)).toEqual([]);
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(claims(captured).bodyHash).toBe(hash(captured.body));
  });
  it('preserves validated raw query spelling/order without semantic canonicalization', async () => {
    const raw = 'cursor=%41bc_-&limit=%32';
    const captured = await capture(
      buildAiForwardingDescriptor(
        input({
          method: 'GET',
          body: undefined,
          externalTarget: '/api/v1/ai/conversations?' + raw,
        }),
      ),
    );
    expect(captured.target).toBe('/api/conversations?' + raw);
    expect(claims(captured).queryHash).toBe(fieldHash('raw-query', raw));
    expect(claims(captured).queryHash).not.toBe(
      fieldHash('raw-query', 'limit=2&cursor=Abc_-'),
    );
  });
  it('distinguishes absent body, empty object and JSON null with exact wire bytes', async () => {
    const results = [];
    for (const body of [undefined, {}, null])
      results.push(await capture(buildAiForwardingDescriptor(input({ body }))));
    expect(results.map((r) => r.body.toString())).toEqual(['', '{}', 'null']);
    expect(new Set(results.map((r): unknown => claims(r).bodyHash)).size).toBe(
      3,
    );
    expect(results[0].headers['content-type']).toBeUndefined();
  });
  it('binds credentials, identity assertion and idempotency header including absence; strips caller authority headers', async () => {
    const captured = await capture(
      buildAiForwardingDescriptor(
        input({
          headers: {
            ...input().headers,
            cookie:
              'access_token=access-token-fixture; refresh_token=private-refresh-canary',
            [AI_INTEGRITY_HEADER]: 'forged',
            'x-user-id': 'foreign',
            'x-tenant-id': 'foreign',
            'x-gateway-auth-context': 'forged-identity',
          },
          cookies: { access_token: 'access-token-fixture' },
        }),
      ),
    );
    expect(captured.headers.cookie).toBeUndefined();
    expect(captured.headers['x-user-id']).toBeUndefined();
    expect(captured.headers.authorization).toBe('Bearer access-token-fixture');
    expect(captured.headers[AI_INTEGRITY_HEADER]).not.toBe('forged');
    expect(claims(captured)).toMatchObject({
      tokenHash: hash('access-token-fixture'),
      identityAssertionHash: hash('signed-identity-fixture'),
      idempotencyKeyHash: fieldHash(
        'idempotency-key',
        JSON.stringify('fixture-key'),
      ),
    });
    const without = await capture(
      buildAiForwardingDescriptor(
        input({
          headers: {
            authorization: 'Bearer different',
            'content-type': 'application/json',
          },
          identityAssertion: 'different-assertion',
        }),
      ),
    );
    expect(claims(without)).toMatchObject({
      tokenHash: hash('different'),
      identityAssertionHash: hash('different-assertion'),
      idempotencyKeyHash: fieldHash('idempotency-key', 'null'),
    });
  });
  it('binds method independently and includes strict version, nonce, request ID, key ID and bounded timing', async () => {
    const captured = await capture(buildAiForwardingDescriptor(input()));
    const proof = claims(captured);
    const decoded = jwt.decode(String(captured.headers[AI_INTEGRITY_HEADER]), {
      complete: true,
    });
    expect(decoded?.header).toMatchObject({
      alg: 'HS256',
      kid: keyId,
      typ: AI_INTEGRITY_TYPE,
    });
    expect(proof.exp! - proof.iat!).toBeLessThanOrEqual(10);
    expect(proof.jti).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(proof.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(proof.deadlineAtMs).toBeGreaterThan(Date.now());
    const get = await capture(
      buildAiForwardingDescriptor(
        input({
          method: 'GET',
          body: undefined,
          externalTarget: '/api/v1/ai/conversations',
        }),
      ),
    );
    expect(claims(get).method).toBe('GET');
    expect(proof.method).toBe('POST');
  });
  it('generates unique random nonces and request identifiers across requests', async () => {
    const results = [];
    for (let n = 0; n < 20; n++)
      results.push(claims(await capture(buildAiForwardingDescriptor(input()))));
    expect(new Set(results.map((r) => r.jti)).size).toBe(20);
    expect(new Set(results.map((r): unknown => r.requestId)).size).toBe(20);
  });
  it('protects all signed claims against JWS substitution and rejects expired proofs in a test-only cryptographic check', async () => {
    const captured = await capture(buildAiForwardingDescriptor(input()));
    const compact = String(captured.headers[AI_INTEGRITY_HEADER]),
      parts = compact.split('.');
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    for (const field of [
      'demoIntent',
      'method',
      'pathHash',
      'queryHash',
      'bodyHash',
      'bodyLength',
      'contentType',
      'idempotencyKeyHash',
      'tokenHash',
      'identityAssertionHash',
      'deadlineAtMs',
      'jti',
      'requestId',
    ]) {
      const changed = Buffer.from(
        JSON.stringify({ ...payload, [field]: 'substituted' }),
      ).toString('base64url');
      expect(() =>
        jwt.verify(
          [parts[0], changed, parts[2]].join('.'),
          createSecretKey(material),
          { algorithms: ['HS256'] },
        ),
      ).toThrow('invalid signature');
    }
    expect(() =>
      jwt.verify(compact, createSecretKey(material), {
        algorithms: ['HS256'],
        clockTimestamp: claims(captured).exp!,
      }),
    ).toThrow('jwt expired');
  });
  it('does not expose native header/body mutation methods and rejects a late send', () => {
    const signed = signer.seal(
      buildAiForwardingDescriptor(input({ deadlineAtMs: Date.now() + 2000 })),
    );
    const failure = jest.fn();
    const adapter = openSignedAiRequest(
      signed,
      origin,
      (response) => response.resume(),
      failure,
    );
    expect(Object.keys(adapter).sort()).toEqual(['cancel', 'send']);
    adapter.cancel();
    expect(failure).toHaveBeenCalledTimes(1);
    expect(() => adapter.send()).toThrow(
      'AI request integrity unavailable or invalid',
    );
    const descriptor = buildAiForwardingDescriptor(input());
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10001);
    try {
      expect(() => signer.seal(descriptor)).toThrow(
        'AI request integrity unavailable or invalid',
      );
    } finally {
      now.mockRestore();
    }
  });
  it('accepts the exact 32-KiB serialized wire limit', async () => {
    const captured = await capture(
      buildAiForwardingDescriptor(input({ body: 'x'.repeat(32766) })),
    );
    expect(captured.body.length).toBe(32768);
    expect(claims(captured).bodyLength).toBe(32768);
  });
  it('bounds an actual stalled HTTP response by the signed deadline with sanitized failure', async () => {
    const stalled = http.createServer((request) => request.resume());
    await new Promise<void>((resolve) =>
      stalled.listen(0, '127.0.0.1', resolve),
    );
    const address = stalled.address();
    if (!address || typeof address === 'string')
      throw new Error('No disposable listener');
    try {
      const signed = signer.seal(
        buildAiForwardingDescriptor(input({ deadlineAtMs: Date.now() + 100 })),
      );
      const failure = await new Promise<Error & { status?: number }>(
        (resolve) => {
          openSignedAiRequest(
            signed,
            `http://127.0.0.1:${address.port}`,
            (response) => response.resume(),
            resolve,
          ).send();
        },
      );
      expect(failure.status).toBe(504);
      expect(failure.message).toBe(
        'AI request integrity unavailable or invalid',
      );
    } finally {
      stalled.closeAllConnections();
      await new Promise<void>((resolve) => stalled.close(() => resolve()));
    }
  });
});
