import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HealthController } from '../../health/health.controller';

const SERVICE = 'notification';
const secret = 'downstream-current-context-test-secret';
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const user: RequestUser = {
  id: 'user-a',
  tenantId: 'tenant-a',
  role: 'EMPLOYEE',
  email: 'current@example.test',
  tenantSlug: 'acme',
  tenantName: 'Current Company',
  firstName: 'Current',
  permissions: [],
  moduleConfig: { marketing: true, accounting: true, operations: true },
  featureConfig: {
    marketing: { leads: true, transport: true },
    operations: { reinsurance: true },
  },
  integrationConfig: { reinsuranceAccounting: false },
};
const accessToken = (extra = {}) =>
  jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      role: 'TENANT_ADMIN',
      permissions: ['old:ADMIN'],
      moduleConfig: { marketing: true, accounting: true, operations: true },
      integrationConfig: { reinsuranceAccounting: true },
      ...extra,
    },
    secret,
  );
function assertion(
  access: string,
  extra = {},
  raw?: string,
  options: jwt.SignOptions = {},
) {
  const { permissions, ...identity } = user;
  return jwt.sign(
    {
      user: identity,
      tokenHash: digest(access),
      permissionsHash: digest(raw ?? JSON.stringify(permissions)),
      ...extra,
    },
    secret,
    {
      issuer: 'workphelo-gateway',
      audience: SERVICE,
      expiresIn: 30,
      ...options,
    },
  );
}
function requestFor(access: string, signed?: string, raw = '[]', headers = {}) {
  const request: { headers: Record<string, string>; user?: RequestUser } = {
    headers: {
      authorization: `Bearer ${access}`,
      'x-user-permissions': raw,
      ...(signed ? { 'x-gateway-auth-context': signed } : {}),
      ...headers,
    },
  };
  return { request, context: new ExecutionContextHost([request]) };
}

describe(`${SERVICE} current Gateway trust contract`, () => {
  const oldSecret = process.env.JWT_SECRET;
  const guard = new JwtAuthGuard();
  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });
  afterAll(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  it('uses the current EMPLOYEE identity and revoked permissions, not stale token admin claims', () => {
    const access = accessToken();
    const req = requestFor(access, assertion(access));
    expect(guard.canActivate(req.context)).toBe(true);
    expect(req.request.user).toMatchObject(user);
  });
  it.each(['TENANT_ADMIN', 'SUPER_ADMIN'])(
    'preserves current %s identity',
    (role) => {
      const access = accessToken();
      const req = requestFor(
        access,
        assertion(access, { user: { ...user, role } }),
      );
      expect(guard.canActivate(req.context)).toBe(true);
      expect(req.request.user?.role).toBe(role);
    },
  );
  it('denies a valid legacy JWT without current context', () => {
    expect(() => guard.canActivate(requestFor(accessToken()).context)).toThrow(
      UnauthorizedException,
    );
  });
  it('denies legacy permission headers as a substitute for current context', () => {
    expect(() =>
      guard.canActivate(
        requestFor(accessToken(), undefined, '[]', {
          'x-gateway-permissions-signature': 'legacy',
        }).context,
      ),
    ).toThrow(UnauthorizedException);
  });
  it('rejects wrong-key signatures', () => {
    const access = accessToken();
    const forged = jwt.sign(
      { user, tokenHash: digest(access), permissionsHash: digest('[]') },
      'wrong-key',
      { issuer: 'workphelo-gateway', audience: SERVICE, expiresIn: 30 },
    );
    expect(() => guard.canActivate(requestFor(access, forged).context)).toThrow(
      UnauthorizedException,
    );
  });
  it.each([
    ['other audience', { audience: 'hr' }],
    ['wrong issuer', { issuer: 'client' }],
    ['expired', { expiresIn: -1 }],
  ] as const)('rejects %s assertions', (_label, options) => {
    const access = accessToken();
    expect(() =>
      guard.canActivate(
        requestFor(access, assertion(access, {}, '[]', options)).context,
      ),
    ).toThrow(UnauthorizedException);
  });
  it.each([
    ['different user', { user: { ...user, id: 'other' } }],
    ['different tenant', { user: { ...user, tenantId: 'other' } }],
    ['missing user', { user: null }],
    ['wrong token digest', { tokenHash: 'other' }],
    ['wrong permission digest', { permissionsHash: 'other' }],
    ['missing module state', { user: { ...user, moduleConfig: null } }],
    [
      'malformed feature state',
      { user: { ...user, featureConfig: { marketing: { leads: 'true' } } } },
    ],
    [
      'malformed integration state',
      {
        user: { ...user, integrationConfig: { reinsuranceAccounting: 'true' } },
      },
    ],
    ['future timestamp', { iat: Math.floor(Date.now() / 1000) + 60 }],
  ])('rejects %s even with a valid signature', (_label, extra) => {
    const access = accessToken();
    expect(() =>
      guard.canActivate(requestFor(access, assertion(access, extra)).context),
    ).toThrow(UnauthorizedException);
  });
  it.each(['not-json', '{}', '[123]'])(
    'rejects malformed permissions %p even when its digest is signed',
    (raw) => {
      const access = accessToken();
      expect(() =>
        guard.canActivate(
          requestFor(access, assertion(access, {}, raw), raw).context,
        ),
      ).toThrow(UnauthorizedException);
    },
  );
  it('rejects permission modification after signing', () => {
    const access = accessToken();
    expect(() =>
      guard.canActivate(
        requestFor(access, assertion(access), '["old:ADMIN"]').context,
      ),
    ).toThrow(UnauthorizedException);
  });
  it('ignores spoofed identity/display headers and never substitutes token integration flags', () => {
    const access = accessToken();
    const req = requestFor(access, assertion(access), '[]', {
      'x-user-role': 'SUPER_ADMIN',
      'x-tenant-id': 'other',
      'x-user-id': 'other',
      'x-tenant-name': 'Forged Company',
      'x-user-first-name': 'Forged Name',
    });
    expect(guard.canActivate(req.context)).toBe(true);
    expect(req.request.user).toMatchObject(user);
    expect(req.request.user?.integrationConfig?.reinsuranceAccounting).toBe(
      false,
    );
  });
  it('supports cookie authentication without weakening the assertion requirement', () => {
    const access = accessToken();
    const req = requestFor(access, assertion(access));
    delete req.request.headers.authorization;
    req.request.headers.cookie = `access_token=${access}`;
    expect(guard.canActivate(req.context)).toBe(true);
  });
  it('rejects invalid or expired original access tokens', () => {
    for (const access of [
      'invalid',
      accessToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
    ]) {
      expect(() =>
        guard.canActivate(requestFor(access, assertion(access)).context),
      ).toThrow(UnauthorizedException);
    }
  });
  it('rejects assertions older than 30 seconds even if their expiry is later', () => {
    const access = accessToken();
    const signed = assertion(
      access,
      { iat: Math.floor(Date.now() / 1000) - 31 },
      '[]',
      { expiresIn: 300 },
    );
    expect(() => guard.canActivate(requestFor(access, signed).context)).toThrow(
      UnauthorizedException,
    );
  });
  it('rejects an assertion without an explicit expiry', () => {
    const access = accessToken();
    const signed = jwt.sign(
      { user, tokenHash: digest(access), permissionsHash: digest('[]') },
      secret,
      { issuer: 'workphelo-gateway', audience: SERVICE },
    );
    expect(() => guard.canActivate(requestFor(access, signed).context)).toThrow(
      UnauthorizedException,
    );
  });
  it('keeps health unauthenticated with its existing readiness behavior', async () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, HealthController),
    ).toBeUndefined();
    const health = Reflect.construct(HealthController, [
      {
        check: jest.fn().mockResolvedValue(undefined),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      },
    ]) as { check: () => unknown };
    expect(await health.check()).toMatchObject({ status: 'ok' });
  });
});
