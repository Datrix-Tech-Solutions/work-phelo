/* eslint-disable @typescript-eslint/unbound-method -- Reflector needs original handler identities; these tests never invoke them. */
import 'reflect-metadata';
import { ForbiddenException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RequireModule } from '../decorators/module.decorator';
import { RequireFeature } from '../decorators/feature.decorator';
import {
  AppraisalGoalsController,
  AppraisalObjectivesController,
} from '../../appraisal-goals/appraisal-goals.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ModuleGuard } from './module.guard';
import { FeatureGuard } from './feature.guard';
import { PermissionsGuard } from './permissions.guard';

@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
class EntitledController {
  inherited() {}

  @RequireModule('operations')
  @RequireFeature('operations', 'projects')
  overridden() {}
}

class MethodOnlyController {
  @RequireModule('hr')
  @RequireFeature('hr', 'appraisals')
  entitled() {}

  undecorated() {}
}

const enabled = {
  role: 'EMPLOYEE',
  permissions: [],
  moduleConfig: { hr: true },
  featureConfig: { hr: { appraisals: true } },
};

function context(
  controller: Type<object>,
  handler: (...args: never[]) => unknown,
  user: unknown,
) {
  return new ExecutionContextHost([{ user }], controller, handler);
}

describe('HR entitlement guard resolution', () => {
  const reflector = new Reflector();
  const moduleGuard = new ModuleGuard(reflector);
  const featureGuard = new FeatureGuard(reflector);
  const permissionGuard = new PermissionsGuard(reflector);
  const inherited = (user: unknown) =>
    context(EntitledController, EntitledController.prototype.inherited, user);
  const overridden = (user: unknown) =>
    context(EntitledController, EntitledController.prototype.overridden, user);

  it.each([
    ['class-only', EntitledController, EntitledController.prototype.inherited],
    [
      'method-only',
      MethodOnlyController,
      MethodOnlyController.prototype.entitled,
    ],
  ] as const)(
    'enforces %s metadata without mocks',
    (_name, controller, handler) => {
      expect(
        moduleGuard.canActivate(context(controller, handler, enabled)),
      ).toBe(true);
      expect(
        featureGuard.canActivate(context(controller, handler, enabled)),
      ).toBe(true);
      expect(() =>
        moduleGuard.canActivate(
          context(controller, handler, {
            ...enabled,
            moduleConfig: { hr: false },
          }),
        ),
      ).toThrow(ForbiddenException);
      expect(() =>
        featureGuard.canActivate(
          context(controller, handler, {
            ...enabled,
            featureConfig: { hr: { appraisals: false } },
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('uses the explicit method module instead of the class module', () => {
    expect(
      moduleGuard.canActivate(
        overridden({
          ...enabled,
          moduleConfig: { hr: false, operations: true },
        }),
      ),
    ).toBe(true);
    expect(() =>
      moduleGuard.canActivate(
        overridden({
          ...enabled,
          moduleConfig: { hr: true, operations: false },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('uses the entire explicit method feature requirement instead of the class feature', () => {
    expect(
      featureGuard.canActivate(
        overridden({
          ...enabled,
          featureConfig: {
            hr: { appraisals: false },
            operations: { projects: true },
          },
        }),
      ),
    ).toBe(true);
    expect(() =>
      featureGuard.canActivate(
        overridden({
          ...enabled,
          featureConfig: {
            hr: { appraisals: true },
            operations: { projects: false },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([undefined, null, {}, [], 'hr', 1])(
    'fails closed with missing/malformed module config: %p',
    (moduleConfig) => {
      expect(() =>
        moduleGuard.canActivate(inherited({ ...enabled, moduleConfig })),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([undefined, null, false, 'true', 'false', 1, {}, []])(
    'requires an actual true module entitlement, not %p',
    (hr) => {
      expect(() =>
        moduleGuard.canActivate(
          inherited({ ...enabled, moduleConfig: { hr } }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([undefined, null, {}, [], 'hr', 1, { hr: null }, { hr: {} }])(
    'fails closed with missing/malformed feature config: %p',
    (featureConfig) => {
      expect(() =>
        featureGuard.canActivate(inherited({ ...enabled, featureConfig })),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([undefined, null, false, 'true', 'false', 1, {}, []])(
    'requires an actual true feature entitlement, not %p',
    (appraisals) => {
      expect(() =>
        featureGuard.canActivate(
          inherited({
            ...enabled,
            featureConfig: { hr: { appraisals } },
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([undefined, null, {}])(
    'denies required entitlements without user state: %p',
    (user) => {
      expect(() => moduleGuard.canActivate(inherited(user))).toThrow(
        ForbiddenException,
      );
      expect(() => featureGuard.canActivate(inherited(user))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('preserves allow-through for absent metadata, even without entitlement context', () => {
    const undecorated = context(
      MethodOnlyController,
      MethodOnlyController.prototype.undecorated,
      undefined,
    );
    expect(moduleGuard.canActivate(undecorated)).toBe(true);
    expect(featureGuard.canActivate(undecorated)).toBe(true);
  });

  it.each(['SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE'])(
    '%s never bypasses a disabled entitlement',
    (role) => {
      expect(() =>
        moduleGuard.canActivate(
          inherited({
            ...enabled,
            role,
            moduleConfig: { hr: false },
          }),
        ),
      ).toThrow(ForbiddenException);
      expect(() =>
        featureGuard.canActivate(
          inherited({
            ...enabled,
            role,
            featureConfig: { hr: { appraisals: false } },
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([
    [
      'goals',
      AppraisalGoalsController,
      AppraisalGoalsController.prototype.list,
    ],
    [
      'objectives',
      AppraisalObjectivesController,
      AppraisalObjectivesController.prototype.list,
    ],
  ] as const)(
    'closes the real appraisal %s controller class-metadata bypass',
    (_name, controller, handler) => {
      const makeContext = (user: unknown) => context(controller, handler, user);
      expect(moduleGuard.canActivate(makeContext(enabled))).toBe(true);
      expect(featureGuard.canActivate(makeContext(enabled))).toBe(true);
      expect(() =>
        moduleGuard.canActivate(
          makeContext({
            ...enabled,
            moduleConfig: { hr: false },
          }),
        ),
      ).toThrow(ForbiddenException);
      expect(() =>
        featureGuard.canActivate(
          makeContext({
            ...enabled,
            featureConfig: { hr: { appraisals: false } },
          }),
        ),
      ).toThrow(ForbiddenException);
      expect(reflector.get(GUARDS_METADATA, controller)).toEqual([
        JwtAuthGuard,
        ModuleGuard,
        FeatureGuard,
        PermissionsGuard,
      ]);
    },
  );

  it('does not turn enabled entitlements into granular permission grants', () => {
    const createGoal = context(
      AppraisalGoalsController,
      AppraisalGoalsController.prototype.create,
      enabled,
    );
    expect(moduleGuard.canActivate(createGoal)).toBe(true);
    expect(featureGuard.canActivate(createGoal)).toBe(true);
    expect(() => permissionGuard.canActivate(createGoal)).toThrow(
      ForbiddenException,
    );
  });
});
