import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import * as http from 'http';
import * as jwt from 'jsonwebtoken';
import { ProxyController } from './proxy.controller';

jest.mock('http', () => ({
  ...jest.requireActual<typeof import('http')>('http'),
  __esModule: true,
  request: jest.fn(),
}));

describe('Gateway current-state authorization boundary', () => {
  const secret = 'current-state-test-secret';
  const previousEnv = { ...process.env };
  let controller: ProxyController;
  let outgoing: jest.SpyInstance;
  let authStatus: number;
  let authBody: unknown;
  let failure: 'network' | 'timeout' | undefined;
  let userId: string;
  let sequence = 0;
  const currentUser = () => ({
    id: userId,
    email: 'current@example.test',
    role: 'EMPLOYEE',
    tenantId: 'tenant-a',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Current',
    moduleConfig: { hr: true },
    integrationConfig: { reinsuranceAccounting: false },
    featureConfig: { hr: { payroll: false } },
  });
  const token = (extra = {}) =>
    jwt.sign(
      {
        sub: userId,
        tenantId: 'tenant-a',
        email: 'stale@example.test',
        role: 'TENANT_ADMIN',
        tenantSlug: 'old-slug',
        moduleConfig: { hr: true },
        featureConfig: { hr: { payroll: true } },
        permissions: ['payroll:APPROVE'],
        ...extra,
      },
      secret,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = secret;
    process.env.AUTH_SERVICE_URL = 'http://auth.test:4001';
    process.env.HR_SERVICE_URL = 'http://hr.test:4002';
    userId = `user-${++sequence}`;
    authStatus = 200;
    authBody = { user: currentUser(), permissions: [] };
    failure = undefined;
    controller = new ProxyController();
    outgoing = jest
      .spyOn(
        controller as unknown as { createProxyRequest: () => unknown },
        'createProxyRequest',
      )
      .mockReturnValue({
        setTimeout: jest.fn(),
        on: jest.fn(),
        setHeader: jest.fn(),
        end: jest.fn(),
        write: jest.fn(),
      });
    jest
      .spyOn(http, 'request')
      .mockImplementation((_options: unknown, callback: unknown) => {
        const req = new EventEmitter() as EventEmitter & {
          end: () => void;
          destroy: () => void;
          setTimeout: (ms: number, handler: () => void) => void;
        };
        req.setTimeout = (_ms, handler) => {
          if (failure === 'timeout') queueMicrotask(handler);
        };
        req.destroy = () => {};
        req.end = () => {
          if (failure === 'timeout') return;
          if (failure === 'network') {
            req.emit('error', new Error('connection failed'));
            return;
          }
          const res = Object.assign(new EventEmitter(), {
            statusCode: authStatus,
            resume: jest.fn(),
          });
          (callback as (res: unknown) => void)(res);
          res.emit(
            'data',
            typeof authBody === 'string' ? authBody : JSON.stringify(authBody),
          );
          res.emit('end');
        };
        return req as http.ClientRequest;
      });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...previousEnv };
  });

  async function send(
    path = '/api/v1/hr/employees',
    extraToken = {},
    headers: Record<string, string> = {},
    cookies: Record<string, string> = {},
    omitAuthorization = false,
  ) {
    const requestHeaders: Record<string, string> = {
      authorization: `Bearer ${token(extraToken)}`,
      ...headers,
    };
    if (omitAuthorization) delete requestHeaders.authorization;
    const req = {
      path: path.split('?')[0],
      url: path,
      originalUrl: path,
      method: 'GET',
      headers: requestHeaders,
      cookies,
      on: jest.fn(),
      off: jest.fn(),
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    await controller.proxy(req as never, res as never);
    return { req, res };
  }

  it.each([401, 403, 404, 500, 302])(
    'rejects Auth %s instead of proxying with empty permissions',
    async (status) => {
      authStatus = status;
      authBody = { message: 'Not available' };
      const { res } = await send();
      expect(outgoing).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(
        status === 401 ? 401 : status === 403 || status === 404 ? 403 : 503,
      );
    },
  );
  it('rejects network failure instead of proxying with empty permissions', async () => {
    failure = 'network';
    const { res } = await send();
    expect(outgoing).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it('bounds Auth lookup time and fails closed on timeout', async () => {
    failure = 'timeout';
    const { res } = await send();
    expect(outgoing).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it('maps unexpected Auth lookup exceptions to an unavailable response', async () => {
    jest
      .spyOn(
        controller as unknown as { fetchCurrentState: () => Promise<unknown> },
        'fetchCurrentState',
      )
      .mockRejectedValue(new Error('infrastructure details must not leak'));
    const { res } = await send();
    expect(outgoing).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Current authorization state is unavailable',
      statusCode: 503,
    });
  });
  it.each([
    'permissions',
    'moduleConfig',
    'featureConfig',
    'integrationConfig',
  ])(
    'rejects malformed current %s instead of trusting JWT state',
    async (field) => {
      const user = currentUser();
      authBody =
        field === 'permissions'
          ? { user, permissions: [123] }
          : {
              user: {
                ...user,
                [field]:
                  field === 'moduleConfig'
                    ? { hr: 'true' }
                    : { hr: { payroll: 'true' } },
              },
              permissions: [],
            };
      await send();
      expect(outgoing).not.toHaveBeenCalled();
    },
  );
  it.each([
    'not json',
    {},
    { permissions: [] },
    { user: null, permissions: [] },
  ])('rejects malformed Auth payload %p', async (body) => {
    authBody = body;
    const { res } = await send();
    expect(outgoing).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it.each([429, 500])('logs the Auth %s behind a 503', async (status) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    authStatus = status;
    const { res } = await send();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(warn).toHaveBeenCalledWith(
      `Auth state lookup failed: Auth responded ${status}`,
    );
  });
  it.each([
    ['timeout', 'timed out after 5000ms'],
    ['network', 'request error connection failed'],
  ] as const)('logs a %s failure of the Auth lookup', async (kind, reason) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    failure = kind;
    await send();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`Auth state lookup failed: ${reason}`);
  });
  it('does not log a rejected session as a lookup failure', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    authStatus = 401;
    await send();
    expect(warn).not.toHaveBeenCalled();
  });
  it('forwards only current permissions and signs current role/entitlements', async () => {
    const { req } = await send();
    expect(outgoing).toHaveBeenCalledTimes(1);
    expect(req.headers['x-user-permissions']).toBe('[]');
    expect(req.headers['x-user-role']).toBe('EMPLOYEE');
    const signed = jwt.verify(req.headers['x-gateway-auth-context'], secret, {
      issuer: 'workphelo-gateway',
      audience: 'hr',
    }) as jwt.JwtPayload;
    expect(signed.user).toMatchObject({
      role: 'EMPLOYEE',
      integrationConfig: { reinsuranceAccounting: false },
      featureConfig: { hr: { payroll: false } },
    });
    expect(signed.user).not.toHaveProperty('permissions');
    expect(signed.permissionsHash).toBeDefined();
  });
  it('does not cache a success across membership/user/tenant revocation', async () => {
    await send();
    authStatus = 401;
    await send();
    expect(outgoing).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledTimes(2);
  });
  it('forwards enabled current integration flags in the Reinsurance audience context', async () => {
    process.env.REINSURANCE_SERVICE_URL = 'http://reinsurance.test:4007';
    const integrationConfig = { 'operations.reinsuranceAccounting': true };
    authBody = {
      user: {
        ...currentUser(),
        integrationConfig,
        moduleConfig: { operations: true },
        featureConfig: { operations: { reinsurance: true } },
      },
      permissions: ['operations.reinsurance.dashboard:VIEW'],
    };
    const { req } = await send('/api/v1/operations/reinsurance/access/verify');
    const signed = jwt.verify(req.headers['x-gateway-auth-context'], secret, {
      issuer: 'workphelo-gateway',
      audience: 'reinsurance',
    }) as jwt.JwtPayload;
    expect(signed.user).toMatchObject({ integrationConfig });
    expect(outgoing).toHaveBeenCalledTimes(1);
  });
  it('rejects a token whose current tenant or user no longer matches', async () => {
    authBody = {
      user: { ...currentUser(), tenantId: 'other-tenant' },
      permissions: [],
    };
    const { res } = await send();
    expect(outgoing).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('routes public Inventory health without an Auth current-state lookup', async () => {
    process.env.INVENTORY_SERVICE_URL = 'http://inventory.test:4009';
    await send(
      '/api/v1/operations/inventory/health',
      {},
      { authorization: '' },
    );
    expect(http.request).not.toHaveBeenCalled();
    expect(outgoing).toHaveBeenCalledTimes(1);
    const call = outgoing.mock.calls[0] as unknown[];
    expect(call[1]).toMatchObject({
      hostname: 'inventory.test',
      port: 4009,
      path: '/api/health',
    });
  });
  it('signs the current context for the Inventory namespace', async () => {
    process.env.INVENTORY_SERVICE_URL = 'http://inventory.test:4009';
    // Proxy infrastructure test only; the scaffold exposes no business route.
    const { req } = await send('/api/v1/operations/inventory');
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(outgoing).toHaveBeenCalledTimes(1);
    const signed = jwt.verify(req.headers['x-gateway-auth-context'], secret, {
      issuer: 'workphelo-gateway',
      audience: 'inventory',
    }) as jwt.JwtPayload;
    expect(signed.user).toMatchObject({ id: userId, role: 'EMPLOYEE' });
  });
  it('does not proxy the Inventory namespace if current Auth state is unavailable', async () => {
    process.env.INVENTORY_SERVICE_URL = 'http://inventory.test:4009';
    failure = 'network';
    const { res } = await send('/api/v1/operations/inventory');
    expect(res.status).toHaveBeenCalledWith(503);
    expect(outgoing).not.toHaveBeenCalled();
  });
  it('strips forged identity, permission and current-context headers', async () => {
    const { req } = await send(
      undefined,
      {},
      {
        'x-user-id': 'attacker',
        'x-user-role': 'SUPER_ADMIN',
        'x-tenant-id': 'other',
        'x-user-permissions': '["payroll:APPROVE"]',
        'x-gateway-permissions-signature': 'forged',
        'x-gateway-auth-context': 'forged',
      },
    );
    expect(req.headers['x-user-id']).toBe(userId);
    expect(req.headers['x-user-role']).toBe('EMPLOYEE');
    expect(req.headers['x-gateway-auth-context']).not.toBe('forged');
  });
  it('keeps careers access limited to allowed paths with fresh current state', async () => {
    await send('/api/v1/hr/recruitment/vacancies', { scope: 'careers' });
    expect(outgoing).toHaveBeenCalledTimes(1);
    const { res } = await send('/api/v1/hr/employees', { scope: 'careers' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(outgoing).toHaveBeenCalledTimes(1);
  });
  it.each([401, 500])(
    'does not forward careers requests after Auth %s',
    async (status) => {
      authStatus = status;
      await send('/api/v1/hr/recruitment/vacancies', { scope: 'careers' });
      expect(outgoing).not.toHaveBeenCalled();
    },
  );

  describe('AI routing infrastructure (mock downstream only)', () => {
    beforeEach(() => {
      process.env.AI_SERVICE_URL = 'http://ai.test:4011';
    });
    it('strips caller integrity proofs without signing eligibility or requiring the new key', async () => {
      delete process.env.AI_REQUEST_SIGNING_KEY;
      const { req } = await send(
        '/api/v1/ai/eligibility',
        {},
        { 'x-ai-request-integrity': 'private-forged-proof' },
      );
      expect(req.headers['x-ai-request-integrity']).toBeUndefined();
      expect(outgoing).toHaveBeenCalledTimes(1);
      const calls = outgoing.mock.calls as unknown as [
        boolean,
        http.RequestOptions,
        unknown,
      ][];
      expect(calls[0][1].path).toBe('/api/eligibility');
      expect(
        (calls[0][1].headers as Record<string, unknown>)[
          'x-ai-request-integrity'
        ],
      ).toBeUndefined();
    });
    it('rejects an empty Authorization header rather than silently switching to a cookie', async () => {
      const selected = token();
      const { req } = await send(
        '/api/v1/ai/eligibility',
        {},
        {
          authorization: '',
          cookie: `access_token=${selected}; refresh_token=private-refresh`,
        },
        { access_token: selected },
      );
      // An empty supplied Authorization header is ambiguous, not a second valid credential.
      expect(outgoing).not.toHaveBeenCalled();
      expect(req.headers['x-ai-request-integrity']).toBeUndefined();
    });
    it('preserves cookie-only eligibility using exactly one canonical forwarded credential', async () => {
      const selected = token();
      const { req } = await send(
        '/api/v1/ai/eligibility',
        {},
        { cookie: `access_token=${selected}; refresh_token=private-refresh` },
        { access_token: selected },
        true,
      );
      expect(outgoing).toHaveBeenCalledTimes(1);
      expect(req.headers.authorization).toBe(`Bearer ${selected}`);
      expect(req.headers.cookie).toBeUndefined();
    });
    it('rejects conflicting AI cookies/Bearer before Auth lookup without changing ERP credential precedence', async () => {
      const { res } = await send(
        '/api/v1/ai/eligibility',
        {},
        {},
        { access_token: 'different-cookie' },
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(http.request).not.toHaveBeenCalled();
      expect(outgoing).not.toHaveBeenCalled();
      await send('/api/v1/hr/employees', {}, {}, { access_token: token() });
      expect(outgoing).toHaveBeenCalledTimes(1);
    });
    it('fails closed for conversation signing without valid key configuration', async () => {
      process.env.AI_REQUEST_SIGNING_ENABLED = 'true';
      const { res } = await send('/api/v1/ai/conversations');
      expect(res.status).toHaveBeenCalledWith(503);
      expect(outgoing).not.toHaveBeenCalled();
    });
    it.each([
      '/api/v1/ai//conversations',
      '/api/v1/ai/%63onversations',
      '/api/v1/ai/./conversations',
      '/api/v1/ai/x/../conversations',
      '/api/v1/ai/conversations/',
    ])(
      'does not forward ambiguous future conversation target %s',
      async (path) => {
        const { res } = await send(path);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(outgoing).not.toHaveBeenCalled();
      },
    );

    it.each(['success', 'error', 'timeout'] as const)(
      'redacts AI paths, queries, credentials and upstream error details on %s',
      async (outcome) => {
        const log = jest
          .spyOn(Logger.prototype, 'log')
          .mockImplementation(() => {});
        const warn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => {});
        const error = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => {});
        let fail: ((error: Error) => void) | undefined;
        let timeout: (() => void) | undefined;
        outgoing.mockReturnValue({
          setTimeout: jest.fn((_ms: number, handler: () => void) => {
            timeout = handler;
          }),
          on: jest.fn((event: string, handler: (error: Error) => void) => {
            if (event === 'error') fail = handler;
          }),
          end: jest.fn(),
          destroy: jest.fn(),
        });
        const { req } = await send(
          '/api/v1/ai/private-path-canary?token=private-query-canary',
        );
        if (outcome === 'error') fail?.(new Error('private-error-canary'));
        if (outcome === 'timeout') timeout?.();
        expect(log).toHaveBeenCalledWith('GET /api/v1/ai → ai');
        if (outcome === 'error')
          expect(error).toHaveBeenCalledWith('AI proxy unavailable');
        if (outcome === 'timeout')
          expect(warn).toHaveBeenCalledWith('AI proxy timeout after 30000ms');
        const logs = JSON.stringify([
          log.mock.calls,
          warn.mock.calls,
          error.mock.calls,
        ]);
        expect(logs).not.toContain('private-');
        expect(logs).not.toContain(req.headers.authorization.slice(7));
        expect(logs).not.toContain(req.headers['x-gateway-auth-context']);
      },
    );

    it('maps the AI namespace and preserves query parameters with current-bound assertions', async () => {
      const { req } = await send('/api/v1/ai/routing-canary?probe=1');
      expect(http.request).toHaveBeenCalledTimes(1);
      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/me', hostname: 'auth.test' }),
        expect.any(Function),
      );
      expect(outgoing).toHaveBeenCalledWith(
        false,
        expect.objectContaining({
          hostname: 'ai.test',
          port: 4011,
          path: '/api/routing-canary?probe=1',
        }),
        expect.any(Function),
      );
      const assertion = jwt.verify(
        req.headers['x-gateway-auth-context'],
        secret,
        {
          algorithms: ['HS256'],
          issuer: 'workphelo-gateway',
          audience: 'ai',
        },
      ) as jwt.JwtPayload;
      expect(assertion.user).toMatchObject({
        id: userId,
        role: 'EMPLOYEE',
        tenantId: 'tenant-a',
      });
      expect(assertion.exp! - assertion.iat!).toBe(30);
      expect(req.headers['x-user-permissions']).toBe('[]');
      expect(assertion.permissionsHash).toBe(
        createHash('sha256').update('[]').digest('hex'),
      );
      expect(assertion.tokenHash).toBe(
        createHash('sha256')
          .update(req.headers.authorization.replace('Bearer ', ''))
          .digest('hex'),
      );
      expect(req.headers['x-gateway-permissions-signature']).toBe(
        createHmac('sha256', secret)
          .update(`${userId}:tenant-a:[]`)
          .digest('hex'),
      );
      // This proves proxy infrastructure, not an existing authenticated AI API.
    });

    it('replaces caller identity/context headers and never takes identity from the query', async () => {
      const { req } = await send(
        '/api/v1/ai/routing-canary?tenantId=attacker',
        {},
        {
          'x-user-id': 'attacker',
          'x-user-email': 'attacker@example.test',
          'x-user-role': 'SUPER_ADMIN',
          'x-tenant-id': 'foreign',
          'x-tenant-slug': 'foreign',
          'x-tenant-name': 'Foreign',
          'x-user-first-name': 'Attacker',
          'x-company-role-id': 'forged',
          'x-user-permissions': '["payroll:APPROVE"]',
          'x-gateway-permissions-signature': 'forged',
          'x-gateway-auth-context': 'forged',
        },
      );
      expect(req.headers['x-user-id']).toBe(userId);
      expect(req.headers['x-tenant-id']).toBe('tenant-a');
      expect(req.headers['x-user-role']).toBe('EMPLOYEE');
      expect(req.headers['x-user-email']).toBe('current@example.test');
      expect(req.headers['x-company-role-id']).toBeUndefined();
      expect(req.headers['x-gateway-auth-context']).not.toBe('forged');
      expect(req.headers['x-user-permissions']).toBe('[]');
    });

    it.each(['careers', 'unknown-restricted', '', null, ['careers']])(
      'rejects restricted or unsupported scope %p before Auth/proxy',
      async (scope) => {
        const { res } = await send('/api/v1/ai/routing-canary', { scope });
        expect(res.status).toHaveBeenCalledWith(403);
        expect(http.request).not.toHaveBeenCalled();
        expect(outgoing).not.toHaveBeenCalled();
      },
    );

    it.each([401, 403, 500])('does not proxy after Auth %s', async (status) => {
      authStatus = status;
      const { res } = await send('/api/v1/ai/routing-canary');
      expect(res.status).toHaveBeenCalledWith(status === 500 ? 503 : status);
      expect(outgoing).not.toHaveBeenCalled();
    });

    it.each(['network', 'timeout'] as const)(
      'fails closed on Auth %s failure',
      async (kind) => {
        failure = kind;
        const { res } = await send('/api/v1/ai/routing-canary');
        expect(res.status).toHaveBeenCalledWith(503);
        expect(outgoing).not.toHaveBeenCalled();
      },
    );

    it('does not reuse prior authorization after revocation', async () => {
      await send('/api/v1/ai/routing-canary');
      authStatus = 401;
      const { res } = await send('/api/v1/ai/routing-canary');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(outgoing).toHaveBeenCalledTimes(1);
      expect(http.request).toHaveBeenCalledTimes(2);
    });

    it.each([undefined, 'not-a-url'])(
      'fails closed for unconfigured/invalid AI URL %p',
      async (url) => {
        if (url === undefined) delete process.env.AI_SERVICE_URL;
        else process.env.AI_SERVICE_URL = url;
        const { res } = await send('/api/v1/ai/routing-canary');
        expect(res.status).toHaveBeenCalledWith(503);
        expect(outgoing).not.toHaveBeenCalled();
        await send();
        expect(outgoing).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['health', 'ready', 'health/', 'ready/'])(
      'does not expose the internal %s probe through the business namespace',
      async (probe) => {
        const { res } = await send(`/api/v1/ai/${probe}`);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(outgoing).not.toHaveBeenCalled();
      },
    );

    it.each([
      'health',
      'ready',
      'inference',
      'conversations',
      'eligibility',
      'docs',
    ])('does not make AI %s public', async (path) => {
      const { res } = await send(
        `/api/v1/ai/${path}`,
        {},
        { authorization: '' },
      );
      expect(res.status).toHaveBeenCalledWith(
        path === 'conversations' ? 503 : 401,
      );
      expect(http.request).not.toHaveBeenCalled();
      expect(outgoing).not.toHaveBeenCalled();
    });

    it('rejects invalid session JWTs before Auth/proxy', async () => {
      const { res } = await send(
        '/api/v1/ai/routing-canary',
        {},
        { authorization: 'Bearer invalid' },
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(outgoing).not.toHaveBeenCalled();
    });

    it('handles an unavailable AI upstream without leaking details', async () => {
      let fail: ((error: Error) => void) | undefined;
      outgoing.mockReturnValue({
        setTimeout: jest.fn(),
        on: jest.fn((event: string, handler: (error: Error) => void) => {
          if (event === 'error') fail = handler;
        }),
        end: jest.fn(),
      });
      const { res } = await send('/api/v1/ai/routing-canary');
      fail?.(new Error('connect ECONNREFUSED ai.test:4011'));
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Service temporarily unavailable',
        statusCode: 503,
      });
    });

    it.each([
      ['HR_SERVICE_URL', '/api/v1/hr/employees', '/employees', 'hr'],
      [
        'MARKETING_SERVICE_URL',
        '/api/v1/marketing/prospects',
        '/api/prospects',
        'marketing',
      ],
      [
        'ACCOUNTING_SERVICE_URL',
        '/api/v1/accounting/journals',
        '/api/journals',
        'accounting',
      ],
      [
        'REINSURANCE_SERVICE_URL',
        '/api/v1/operations/reinsurance/placements',
        '/api/placements',
        'reinsurance',
      ],
      [
        'INVENTORY_SERVICE_URL',
        '/api/v1/operations/inventory/items',
        '/api/items',
        'inventory',
      ],
    ])(
      'preserves %s routing and audience',
      async (envName, path, downstream, audience) => {
        process.env[envName] = 'http://existing.test:4999';
        const { req } = await send(path);
        expect(outgoing).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ path: downstream }),
          expect.any(Function),
        );
        expect(
          jwt.verify(req.headers['x-gateway-auth-context'], secret, {
            issuer: 'workphelo-gateway',
            audience,
          }),
        ).toMatchObject({ aud: audience });
      },
    );
  });
});
