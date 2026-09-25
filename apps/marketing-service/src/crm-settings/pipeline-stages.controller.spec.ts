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
import { MarketingCrmSettingsPermission } from './crm-settings.permissions';
import { PipelineStagesController } from './pipeline-stages.controller';

function executionContextFor(user?: Partial<RequestUser>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };
}

describe('PipelineStagesController authorization contract', () => {
  it('requires the marketing module and pipeline feature', () => {
    expect(Reflect.getMetadata(MODULE_KEY, PipelineStagesController)).toBe(
      'marketing',
    );
    expect(Reflect.getMetadata(FEATURE_KEY, PipelineStagesController)).toEqual({
      module: 'marketing',
      feature: 'pipeline',
    });
  });

  it('requires read permissions on list/detail endpoints', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PipelineStagesController.prototype.list,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
      MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PipelineStagesController.prototype.findOne,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
      MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW,
    ]);
  });

  it('requires manage permissions on create/update/archive endpoints', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PipelineStagesController.prototype.create,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_CREATE,
      MarketingCrmSettingsPermission.PIPELINE_STAGES_CREATE,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PipelineStagesController.prototype.update,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_EDIT,
      MarketingCrmSettingsPermission.PIPELINE_STAGES_EDIT,
    ]);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        PipelineStagesController.prototype.archive,
      ),
    ).toEqual([
      MarketingCrmSettingsPermission.CRM_SETTINGS_DELETE,
      MarketingCrmSettingsPermission.PIPELINE_STAGES_DELETE,
    ]);
  });
});

describe('Pipeline stage authorization guards', () => {
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

  it('rejects disabled Marketing pipeline feature access', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        module: 'marketing',
        feature: 'pipeline',
      }),
    };
    const guard = new FeatureGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        executionContextFor({
          featureConfig: { marketing: { pipeline: false } },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects users without required pipeline permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW],
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

  it('allows users with pipeline-specific or broad CRM settings permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === PERMISSIONS_KEY
            ? undefined
            : [
                MarketingCrmSettingsPermission.CRM_SETTINGS_VIEW,
                MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW,
              ],
        ),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(
        executionContextFor({
          role: 'EMPLOYEE',
          permissions: [MarketingCrmSettingsPermission.PIPELINE_STAGES_VIEW],
        }) as never,
      ),
    ).toBe(true);
  });
});
