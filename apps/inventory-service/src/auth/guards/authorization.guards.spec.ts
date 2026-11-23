import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { RequireModule } from '../decorators/module.decorator';
import { RequireFeature } from '../decorators/feature.decorator';
import { PermissionExempt, RequirePermissions } from '../decorators/permissions.decorator';
import { ModuleGuard } from './module.guard';
import { FeatureGuard } from './feature.guard';
import { PermissionsGuard } from './permissions.guard';

// Synthetic metadata tests, not HTTP endpoints or Inventory business resources.
@RequireModule('test-module')
@RequireFeature('test-module', 'test-feature')
class PolicyFixture {
  undeclared() {}
  @RequirePermissions('test-resource:VIEW')
  declared() {}
  @PermissionExempt('self-service', 'Test fixture checks only policy declaration mechanics.')
  selfService() {}
}
const reflector = new Reflector();
const request = (handler: 'undeclared' | 'declared' | 'selfService', user: unknown) =>
  new ExecutionContextHost([{ user }], PolicyFixture, PolicyFixture.prototype[handler]);

describe('Inventory fail-closed authorization scaffolding', () => {
  const permission = new PermissionsGuard(reflector);
  it.each(['EMPLOYEE', 'TENANT_ADMIN', 'SUPER_ADMIN'])(
    'denies undeclared permission metadata for %s',
    (role) => {
      expect(() =>
        permission.canActivate(request('undeclared', { role, permissions: [] })),
      ).toThrow(ForbiddenException);
    },
  );
  it('checks current grants, not an invented admin role', () => {
    expect(() =>
      permission.canActivate(request('declared', { role: 'EMPLOYEE', permissions: [] })),
    ).toThrow(ForbiddenException);
    expect(
      permission.canActivate(
        request('declared', { role: 'EMPLOYEE', permissions: ['test-resource:VIEW'] }),
      ),
    ).toBe(true);
  });
  it('requires identity even for a justified self-service policy', () => {
    expect(() => permission.canActivate(request('selfService', undefined))).toThrow(
      ForbiddenException,
    );
    expect(
      permission.canActivate(request('selfService', { role: 'EMPLOYEE', permissions: [] })),
    ).toBe(true);
  });
  it.each([false, undefined, 'true'])(
    'does not bypass disabled/malformed entitlements for admins: %p',
    (value) => {
      const ctx = request('declared', {
        role: 'SUPER_ADMIN',
        permissions: [],
        moduleConfig: { 'test-module': value },
        featureConfig: { 'test-module': { 'test-feature': value } },
      });
      expect(() => new ModuleGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
      expect(() => new FeatureGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
    },
  );
  it('honors declared class module/feature metadata when enabled', () => {
    const ctx = request('declared', {
      moduleConfig: { 'test-module': true },
      featureConfig: { 'test-module': { 'test-feature': true } },
    });
    expect(new ModuleGuard(reflector).canActivate(ctx)).toBe(true);
    expect(new FeatureGuard(reflector).canActivate(ctx)).toBe(true);
  });
});
