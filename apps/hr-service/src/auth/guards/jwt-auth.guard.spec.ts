import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '@work-phelo/config';

describe('HR trusted current Gateway context', () => {
  const secret = 'current-context-test-secret';
  const originalSecret = process.env.JWT_SECRET;
  const guard = new JwtAuthGuard();
  const user = {
    id: 'user-a',
    tenantId: 'tenant-a',
    role: 'EMPLOYEE',
    email: 'current@example.test',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Current',
    moduleConfig: { hr: true },
    featureConfig: { hr: { payroll: false } },
    permissions: [],
  };
  const token = (extra = {}) =>
    jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: 'TENANT_ADMIN',
        permissions: ['employees:VIEW'],
        moduleConfig: { hr: true },
        featureConfig: { hr: { payroll: true } },
        ...extra,
      },
      secret,
    );
  const signed = (access: string, extra = {}, options: jwt.SignOptions = {}) =>
    jwt.sign(
      {
        user,
        permissionsHash: createHash('sha256').update('[]').digest('hex'),
        tokenHash: createHash('sha256').update(access).digest('hex'),
        ...extra,
      },
      secret,
      {
        issuer: 'workphelo-gateway',
        audience: 'hr',
        expiresIn: 30,
        ...options,
      },
    );
  const context = (access: string, gateway?: string, headers = {}) => {
    const request: {
      headers: Record<string, string | undefined>;
      user?: typeof user;
    } = {
      headers: {
        authorization: `Bearer ${access}`,
        'x-user-permissions': '[]',
        ...(gateway ? { 'x-gateway-auth-context': gateway } : {}),
        ...headers,
      },
    };
    return {
      request,
      context: new ExecutionContextHost([request]),
    };
  };
  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('uses current role, permissions and entitlements, not stale token admin claims', () => {
    const access = token();
    const req = context(access, signed(access));
    expect(guard.canActivate(req.context)).toBe(true);
    expect(req.request.user).toEqual(user);
    const reflector = {
      getAllAndOverride: () => [Permission.READ_EMPLOYEES],
    } as unknown as Reflector;
    expect(() =>
      new PermissionsGuard(reflector).canActivate(req.context),
    ).toThrow(ForbiddenException);
  });
  it('rejects a valid legacy JWT without current Gateway context', () => {
    expect(() => guard.canActivate(context(token()).context)).toThrow(
      UnauthorizedException,
    );
  });
  it('preserves the admin permission bypass only with trusted current admin context', () => {
    const access = token();
    const req = context(
      access,
      signed(access, { user: { ...user, role: 'TENANT_ADMIN' } }),
    );
    expect(guard.canActivate(req.context)).toBe(true);
    const reflector = {
      getAllAndOverride: () => [Permission.READ_EMPLOYEES],
    } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(req.context)).toBe(true);
  });
  it('does not accept legacy signed permissions as a substitute for current context', () => {
    expect(() =>
      guard.canActivate(
        context(token(), undefined, {
          'x-user-permissions': '["employees:VIEW"]',
          'x-gateway-permissions-signature': 'legacy',
        }).context,
      ),
    ).toThrow(UnauthorizedException);
  });
  it.each(['bad-context', ''])(
    'rejects invalid signed context %p',
    (gateway) => {
      expect(() =>
        guard.canActivate(context(token(), gateway).context),
      ).toThrow(UnauthorizedException);
    },
  );
  it.each([
    ['wrong user', { user: { ...user, id: 'other' } }],
    ['wrong tenant', { user: { ...user, tenantId: 'other' } }],
    ['missing user', { user: null }],
    ['wrong permission digest', { permissionsHash: 'forged-permissions' }],
    ['missing module context', { user: { ...user, moduleConfig: null } }],
    [
      'malformed feature context',
      { user: { ...user, featureConfig: { hr: { payroll: 'true' } } } },
    ],
    ['future assertion', { iat: Math.floor(Date.now() / 1000) + 60 }],
    ['wrong access token', { tokenHash: 'other-token' }],
  ])('rejects %s even with a valid signature', (_label, extra) => {
    const access = token();
    expect(() =>
      guard.canActivate(context(access, signed(access, extra)).context),
    ).toThrow(UnauthorizedException);
  });
  it.each([
    ['wrong audience', { audience: 'marketing' }],
    ['wrong issuer', { issuer: 'client' }],
    ['expired assertion', { expiresIn: -1 }],
  ] as const)('rejects %s', (_label, options) => {
    const access = token();
    expect(() =>
      guard.canActivate(context(access, signed(access, {}, options)).context),
    ).toThrow(UnauthorizedException);
  });
  it('rejects tampered context and wrong-key signatures', () => {
    const access = token();
    const forged = jwt.sign(
      { user, tokenHash: createHash('sha256').update(access).digest('hex') },
      'wrong-key',
      { issuer: 'workphelo-gateway', audience: 'hr', expiresIn: 30 },
    );
    expect(() => guard.canActivate(context(access, forged).context)).toThrow(
      UnauthorizedException,
    );
  });
  it('still rejects invalid or expired original JWTs', () => {
    for (const access of [
      'invalid-token',
      token({ exp: Math.floor(Date.now() / 1000) - 1 }),
    ]) {
      expect(() =>
        guard.canActivate(context(access, signed(access)).context),
      ).toThrow(UnauthorizedException);
    }
  });
  it('ignores spoofed legacy identity headers when trusted context exists', () => {
    const access = token();
    const req = context(access, signed(access), {
      'x-user-role': 'SUPER_ADMIN',
    });
    expect(guard.canActivate(req.context)).toBe(true);
    expect(req.request.user?.role).toBe('EMPLOYEE');
    expect(req.request.user?.permissions).toEqual([]);
  });
  it.each(['["employees:VIEW"]', '[1]', 'not-json', '{}'])(
    'rejects altered or malformed permission header %p',
    (raw) => {
      const access = token();
      expect(() =>
        guard.canActivate(
          context(access, signed(access), { 'x-user-permissions': raw })
            .context,
        ),
      ).toThrow(UnauthorizedException);
    },
  );
});
