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
import { ProspectFollowUpsController } from './prospect-follow-ups.controller';
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

  it('needs no permission to view prospects: the service shows an assignee their own', () => {
    for (const handler of [
      ProspectsController.prototype.list,
      ProspectsController.prototype.findOne,
      ProspectsController.prototype.listInteractions,
      ProspectsController.prototype.listFollowUps,
    ]) {
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler)).toBeUndefined();
    }
  });
});

describe('Managing your own prospects', () => {
  it('needs no permission: the service limits it to the caller’s own prospects unless they hold the tenant-wide one', () => {
    for (const handler of [
      ProspectsController.prototype.update,
      ProspectsController.prototype.remove,
      ProspectsController.prototype.createInteraction,
      ProspectsController.prototype.createFollowUp,
    ]) {
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler)).toBeUndefined();
    }
  });

  it('still needs the create permission to create a prospect', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.create,
      ),
    ).toEqual([MarketingCrmSettingsPermission.PROSPECTS_CREATE]);
  });
});

describe('ProspectFollowUpsController authorization contract', () => {
  it('requires the marketing module and leads feature', () => {
    expect(Reflect.getMetadata(MODULE_KEY, ProspectFollowUpsController)).toBe(
      'marketing',
    );
    expect(
      Reflect.getMetadata(FEATURE_KEY, ProspectFollowUpsController),
    ).toEqual({
      module: 'marketing',
      feature: 'leads',
    });
  });
});

describe('Follow-ups on your own prospects', () => {
  it('need no permission: the service limits them to the caller’s own prospects unless they hold the tenant-wide one', () => {
    for (const handler of [
      ProspectFollowUpsController.prototype.listWorklist,
      ProspectFollowUpsController.prototype.update,
      ProspectFollowUpsController.prototype.cancel,
      ProspectFollowUpsController.prototype.complete,
    ]) {
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler)).toBeUndefined();
    }
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

  it('allows users with prospect view permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_VIEW],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_VIEW],
        }) as never,
      ),
    ).toBe(true);
  });

  it('allows users with prospect edit permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_EDIT],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_EDIT],
        }) as never,
      ),
    ).toBe(true);
  });

  it('rejects users without prospect delete permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_VIEW],
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows users with prospect delete permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
        }) as never,
      ),
    ).toBe(true);
  });

  it('allows users with prospect interaction create permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [
            MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE,
          ],
        }) as never,
      ),
    ).toBe(true);
  });
});
