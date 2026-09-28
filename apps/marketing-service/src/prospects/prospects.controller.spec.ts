/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '@work-phelo/types';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY, FeatureGuard } from '../auth/guards/feature.guard';
import { ModuleGuard, MODULE_KEY } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ProspectsController } from './prospects.controller';

function executionContextFor(user?: Partial<RequestUser>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };
}

describe('ProspectsController authorization contract', () => {
  it('requires the marketing module and leads feature', () => {
    expect(Reflect.getMetadata(MODULE_KEY, ProspectsController)).toBe(
      'marketing',
    );
    expect(Reflect.getMetadata(FEATURE_KEY, ProspectsController)).toEqual({
      module: 'marketing',
      feature: 'leads',
    });
  });

  it('requires prospect create permission on create', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.create,
      ),
    ).toEqual([MarketingCrmSettingsPermission.PROSPECTS_CREATE]);
  });
});

describe('Prospects authorization guards', () => {
  it('rejects disabled Marketing module access', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('marketing'),
    };
    const guard = new ModuleGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        executionContextFor({
          moduleConfig: { marketing: false },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects disabled Marketing leads feature access', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        module: 'marketing',
        feature: 'leads',
      }),
    };
    const guard = new FeatureGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        executionContextFor({
          featureConfig: { marketing: { leads: false } },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects users without prospect create permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_CREATE],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [],
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows users with prospect create permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_CREATE],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_CREATE],
        }) as never,
      ),
    ).toBe(true);
  });
});
