import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { FleetController } from './fleet.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

const handlerNames = [
  'list',
  'options',
  'tripHistory',
  'findOne',
  'create',
  'update',
  'setStatus',
  'assignDriver',
  'unassignDriver',
  'remove',
] as const;

describe('FleetController authorization contract', () => {
  it('requires the marketing module and no extra feature flag', () => {
    expect(Reflect.getMetadata(MODULE_KEY, FleetController)).toBe('marketing');
    expect(Reflect.getMetadata(FEATURE_KEY, FleetController)).toBeUndefined();
  });

  it.each([
    ['list', P.FLEET_VIEW],
    ['options', P.FLEET_VIEW],
    ['findOne', P.FLEET_VIEW],
    ['tripHistory', P.FLEET_VIEW],
    ['create', P.FLEET_CREATE],
    ['update', P.FLEET_EDIT],
    ['setStatus', P.FLEET_EDIT],
    ['assignDriver', P.FLEET_EDIT],
    ['unassignDriver', P.FLEET_EDIT],
    ['remove', P.FLEET_DELETE],
  ] as const)('gates %s behind %s', (method, permission) => {
    expect(anyPermissions(FleetController.prototype[method])).toEqual([
      permission,
    ]);
  });

  it('leaves no route handler ungated', () => {
    const declared = Object.getOwnPropertyNames(FleetController.prototype)
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual([...handlerNames].sort());
  });
});
