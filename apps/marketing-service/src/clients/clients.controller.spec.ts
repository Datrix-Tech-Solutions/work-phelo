/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '@work-phelo/types';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import {
  ClientsController,
  ProspectConversionController,
} from './clients.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[];

describe('ClientsController authorization contract', () => {
  it.each([ClientsController, ProspectConversionController])(
    'requires the marketing module and leads feature on %p',
    (controller) => {
      expect(Reflect.getMetadata(MODULE_KEY, controller)).toBe('marketing');
      expect(Reflect.getMetadata(FEATURE_KEY, controller)).toEqual({
        module: 'marketing',
        feature: 'leads',
      });
    },
  );

  it('requires client view permission on list and detail', () => {
    expect(anyPermissions(ClientsController.prototype.list)).toEqual([
      P.CLIENTS_VIEW,
    ]);
    expect(anyPermissions(ClientsController.prototype.findOne)).toEqual([
      P.CLIENTS_VIEW,
    ]);
  });

  it('requires client create permission on create', () => {
    expect(anyPermissions(ClientsController.prototype.create)).toEqual([
      P.CLIENTS_CREATE,
    ]);
  });

  it('requires assigned or tenant-wide edit permission on update and add-product', () => {
    const edit = [P.CLIENTS_EDIT, P.CLIENTS_EDIT_ALL];
    expect(anyPermissions(ClientsController.prototype.update)).toEqual(edit);
    expect(anyPermissions(ClientsController.prototype.addProduct)).toEqual(
      edit,
    );
  });

  it('requires the interaction create permissions to record a client follow-up', () => {
    expect(
      anyPermissions(ClientsController.prototype.createInteraction),
    ).toEqual([
      P.PROSPECT_INTERACTIONS_CREATE,
      P.PROSPECT_INTERACTIONS_CREATE_ALL,
    ]);
  });

  it('requires assigned or tenant-wide delete permission on delete', () => {
    expect(anyPermissions(ClientsController.prototype.remove)).toEqual([
      P.CLIENTS_DELETE,
      P.CLIENTS_DELETE_ALL,
    ]);
  });

  describe('prospect conversion', () => {
    const handler = ProspectConversionController.prototype.convert;
    const guard = new PermissionsGuard(new Reflector());
    const contextFor = (permissions: string[]) => ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: 'EMPLOYEE', permissions } as Partial<RequestUser>,
        }),
      }),
      getHandler: () => handler,
      getClass: () => ProspectConversionController,
    });

    it('requires client create AND prospect edit permission', () => {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        P.CLIENTS_CREATE,
      ]);
      expect(anyPermissions(handler)).toEqual([
        P.PROSPECTS_EDIT,
        P.PROSPECTS_EDIT_ALL,
      ]);
    });

    it('allows a user holding both permissions', () => {
      expect(
        guard.canActivate(
          contextFor([P.CLIENTS_CREATE, P.PROSPECTS_EDIT]) as never,
        ),
      ).toBe(true);
    });

    it('denies a user who can only create clients', () => {
      expect(() =>
        guard.canActivate(contextFor([P.CLIENTS_CREATE]) as never),
      ).toThrow(ForbiddenException);
    });

    it('denies a user who can only edit prospects', () => {
      expect(() =>
        guard.canActivate(contextFor([P.PROSPECTS_EDIT_ALL]) as never),
      ).toThrow(ForbiddenException);
    });
  });
});
