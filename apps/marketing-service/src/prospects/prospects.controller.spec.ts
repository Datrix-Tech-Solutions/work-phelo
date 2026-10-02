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

  it('requires prospect view permission on list', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.list,
      ),
    ).toEqual([MarketingCrmSettingsPermission.PROSPECTS_VIEW]);
  });

  it('requires prospect view permission on detail', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.findOne,
      ),
    ).toEqual([MarketingCrmSettingsPermission.PROSPECTS_VIEW]);
  });

  it('requires assigned or tenant-wide prospect edit permission on update', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.update,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.PROSPECTS_EDIT,
      MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL,
    ]);
  });

  it('requires assigned or tenant-wide prospect delete permission on remove', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.remove,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.PROSPECTS_DELETE,
      MarketingCrmSettingsPermission.PROSPECTS_DELETE_ALL,
    ]);
  });

  it('requires assigned or tenant-wide prospect interaction view permission on history', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.listInteractions,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_VIEW,
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_VIEW_ALL,
    ]);
  });

  it('requires assigned or tenant-wide prospect interaction create permission on create interaction', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.createInteraction,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE,
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
    ]);
  });

  it('requires assigned or tenant-wide follow-up view permission on history', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.listFollowUps,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW,
      MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW_ALL,
    ]);
  });

  it('requires assigned or tenant-wide follow-up create permission on create follow-up', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectsController.prototype.createFollowUp,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_CREATE,
      MarketingCrmSettingsPermission.FOLLOW_UPS_CREATE_ALL,
    ]);
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

  it('requires assigned or tenant-wide follow-up view permission on worklist', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectFollowUpsController.prototype.listWorklist,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW,
      MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW_ALL,
    ]);
  });

  it('requires assigned or tenant-wide follow-up edit permission on update', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectFollowUpsController.prototype.update,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_EDIT,
      MarketingCrmSettingsPermission.FOLLOW_UPS_EDIT_ALL,
    ]);
  });

  it('requires assigned or tenant-wide follow-up cancel permission on cancel', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectFollowUpsController.prototype.cancel,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_CANCEL,
      MarketingCrmSettingsPermission.FOLLOW_UPS_CANCEL_ALL,
    ]);
  });

  it('requires assigned or tenant-wide follow-up complete permission on complete', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectFollowUpsController.prototype.complete,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.FOLLOW_UPS_COMPLETE,
      MarketingCrmSettingsPermission.FOLLOW_UPS_COMPLETE_ALL,
    ]);
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
