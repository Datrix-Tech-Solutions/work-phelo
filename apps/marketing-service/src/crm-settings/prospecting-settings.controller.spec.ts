/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { ModuleGuard, MODULE_KEY } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from './crm-settings.permissions';
import { ProspectingSettingsController } from './prospecting-settings.controller';

function executionContextFor(user?: Partial<RequestUser>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };
}

describe('ProspectingSettingsController authorization contract', () => {
  it('requires the marketing module and leads feature', () => {
    expect(Reflect.getMetadata(MODULE_KEY, ProspectingSettingsController)).toBe(
      'marketing',
    );
    expect(
      Reflect.getMetadata(FEATURE_KEY, ProspectingSettingsController),
    ).toEqual({ module: 'marketing', feature: 'leads' });
  });

  it('requires product read permissions on list/detail endpoints', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.listProducts,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
      MarketingCrmSettingsPermission.PRODUCTS_VIEW,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.getProduct,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
      MarketingCrmSettingsPermission.PRODUCTS_VIEW,
    ]);
  });

  it('requires product manage permissions on create/update/archive endpoints', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.createProduct,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_CREATE,
      MarketingCrmSettingsPermission.PRODUCTS_CREATE,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.updateProduct,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
      MarketingCrmSettingsPermission.PRODUCTS_EDIT,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.archiveProduct,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_DELETE,
      MarketingCrmSettingsPermission.PRODUCTS_DELETE,
    ]);
  });
});

describe('Marketing authorization guards', () => {
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

  it('rejects users without required read/manage permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PRODUCTS_VIEW],
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

  it('allows users with product-specific or broad CRM settings permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [
                MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
                MarketingCrmSettingsPermission.PRODUCTS_VIEW,
              ],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PRODUCTS_VIEW],
        }) as never,
      ),
    ).toBe(true);
  });
});


describe('Decision maker settings permissions', () => {
  it('requires decision maker read and manage permissions', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.listDecisionMakers,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
      MarketingCrmSettingsPermission.DECISION_MAKERS_VIEW,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ProspectingSettingsController.prototype.updateDecisionMaker,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
      MarketingCrmSettingsPermission.DECISION_MAKERS_EDIT,
    ]);
  });
});
