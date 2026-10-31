import 'reflect-metadata';
import { ForbiddenException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { ModuleGuard } from './module.guard';
import { FeatureGuard } from './feature.guard';
import {
  PERMISSIONS_KEY,
  ANY_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { AccessController } from '../../access/access.controller';
import { PlacementsController } from '../../placements/placements.controller';
import { ReinsuranceWorklistsController } from '../../placements/worklists/reinsurance-worklists.controller';

const secret = 'current-policy-test-secret';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const baseline: RequestUser = {
  id: 'user',
  tenantId: 'tenant',
  tenantSlug: 'acme',
  tenantName: 'Acme',
  firstName: 'Current',
  email: 'current@example.test',
  role: 'EMPLOYEE',
  permissions: [],
  moduleConfig: { marketing: true, accounting: true, operations: true },
  featureConfig: {
    marketing: { 'sales-crm': true, transport: true },
    operations: { reinsurance: true },
  },
};
function authenticated(
  controller: Type<object>,
  handler: (...args: never[]) => unknown,
  overrides = {},
) {
  const user = { ...baseline, ...overrides };
  const access = jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      role: 'TENANT_ADMIN',
      permissions: ['old:ADMIN'],
      moduleConfig: baseline.moduleConfig,
      featureConfig: baseline.featureConfig,
    },
    secret,
  );
  const signed = jwt.sign(
    { user, tokenHash: digest(access), permissionsHash: digest('[]') },
    secret,
    { issuer: 'workphelo-gateway', audience: 'reinsurance', expiresIn: 30 },
  );
  const req = {
    headers: {
      authorization: `Bearer ${access}`,
      'x-user-permissions': '[]',
      'x-gateway-auth-context': signed,
    },
  };
  const ctx = new ExecutionContextHost([req], controller, handler);
  expect(new JwtAuthGuard().canActivate(ctx)).toBe(true);
  return ctx;
}
describe('reinsurance current-role policy regression', () => {
  const previousEnv = { ...process.env };
  const reflector = new Reflector();
  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });
  afterEach(() => {
    process.env = { ...previousEnv };
  });
  const controllers = [
    AccessController,
    PlacementsController,
    ReinsuranceWorklistsController,
  ];
  it.each(controllers)(
    '%p does not grant stale admin bypass on permission-protected actions',
    (controller) => {
      const methods = Object.getOwnPropertyNames(controller.prototype).filter(
        (k) => k !== 'constructor',
      );
      const handler = methods
        .map(
          (k) =>
            Object.getOwnPropertyDescriptor(controller.prototype, k)?.value as (
              ...args: never[]
            ) => unknown,
        )
        .find((h) =>
          [PERMISSIONS_KEY, ANY_PERMISSIONS_KEY].some(
            (key) =>
              reflector.getAllAndOverride<string[]>(key, [h, controller])
                ?.length,
          ),
        );
      expect(handler).toBeDefined();
      if (!handler)
        throw new Error('Expected a permission-protected controller action');
      const ctx = authenticated(controller, handler);
      expect(() => new PermissionsGuard(reflector).canActivate(ctx)).toThrow(
        ForbiddenException,
      );
      const currentAdmin = authenticated(controller, handler, {
        role: 'TENANT_ADMIN',
      });
      expect(new PermissionsGuard(reflector).canActivate(currentAdmin)).toBe(
        true,
      );
      const currentSuperAdmin = authenticated(controller, handler, {
        role: 'SUPER_ADMIN',
      });
      expect(
        new PermissionsGuard(reflector).canActivate(currentSuperAdmin),
      ).toBe(true);
    },
  );
  it('uses current module state even for a current admin', () => {
    const controller = controllers[0];
    const handler = Object.getOwnPropertyDescriptor(
      controller.prototype,
      Object.getOwnPropertyNames(controller.prototype).find(
        (k) => k !== 'constructor',
      )!,
    )?.value as (...args: never[]) => unknown;
    const ctx = authenticated(controller, handler, {
      role: 'TENANT_ADMIN',
      moduleConfig: { marketing: false, accounting: false, operations: false },
    });
    expect(() => new ModuleGuard(reflector).canActivate(ctx)).toThrow(
      ForbiddenException,
    );
  });
  it('uses current feature state rather than the token feature snapshot', () => {
    const controller = controllers[0];
    const handler = Object.getOwnPropertyDescriptor(
      controller.prototype,
      Object.getOwnPropertyNames(controller.prototype).find(
        (k) => k !== 'constructor',
      )!,
    )?.value as (...args: never[]) => unknown;
    const ctx = authenticated(controller, handler, {
      featureConfig: {
        marketing: { 'sales-crm': false, transport: false },
        operations: { reinsurance: false },
      },
    });
    expect(() => new FeatureGuard(reflector).canActivate(ctx)).toThrow(
      ForbiddenException,
    );
  });
});
