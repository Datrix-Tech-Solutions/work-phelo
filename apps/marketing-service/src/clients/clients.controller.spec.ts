/* eslint-disable @typescript-eslint/unbound-method */
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { MODULE_KEY } from '../auth/guards/module.guard';
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

  it('needs no permission to view clients: the service shows an assignee their own', () => {
    expect(anyPermissions(ClientsController.prototype.list)).toBeUndefined();
    expect(anyPermissions(ClientsController.prototype.findOne)).toBeUndefined();
  });

  it('requires client create permission on create', () => {
    expect(anyPermissions(ClientsController.prototype.create)).toEqual([
      P.CLIENTS_CREATE,
    ]);
  });

  it('needs no permission to manage your own client: the service limits update and add-product to the caller’s clients unless they hold the tenant-wide permission', () => {
    expect(anyPermissions(ClientsController.prototype.update)).toBeUndefined();
    expect(
      anyPermissions(ClientsController.prototype.addProduct),
    ).toBeUndefined();
  });

  it('needs no permission to record a follow-up on your own client', () => {
    expect(
      anyPermissions(ClientsController.prototype.createInteraction),
    ).toBeUndefined();
  });

  it('requires assigned or tenant-wide delete permission on delete', () => {
    expect(anyPermissions(ClientsController.prototype.remove)).toEqual([
      P.CLIENTS_DELETE,
      P.CLIENTS_DELETE_ALL,
    ]);
  });

  it('needs no permission to convert your own prospect to a client', () => {
    const handler = ProspectConversionController.prototype.convert;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toBeUndefined();
    expect(anyPermissions(handler)).toBeUndefined();
  });
});
