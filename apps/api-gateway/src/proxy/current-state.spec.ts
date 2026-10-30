import { EventEmitter } from 'events';
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
  ) {
    const requestHeaders: Record<string, string> = {
      authorization: `Bearer ${token(extraToken)}`,
      ...headers,
    };
    const req = {
      path,
      url: path,
      method: 'GET',
      headers: requestHeaders,
      cookies: {},
      on: jest.fn(),
      off: jest.fn(),
    };
    const res = {
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
});
