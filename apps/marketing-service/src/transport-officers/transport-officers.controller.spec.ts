import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { TransportOfficersController } from './transport-officers.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

describe('TransportOfficersController authorization contract', () => {
  it('requires the marketing module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, TransportOfficersController)).toBe(
      'marketing',
    );
  });

  it.each([
    ['list', P.TRANSPORT_OFFICERS_VIEW],
    ['candidates', P.TRANSPORT_OFFICERS_CREATE],
    ['add', P.TRANSPORT_OFFICERS_CREATE],
    ['deactivate', P.TRANSPORT_OFFICERS_EDIT],
    ['activate', P.TRANSPORT_OFFICERS_EDIT],
  ] as const)('gates %s behind %s', (method, permission) => {
    expect(
      anyPermissions(TransportOfficersController.prototype[method]),
    ).toEqual([permission]);
  });

  it('leaves no route handler ungated', () => {
    const declared = Object.getOwnPropertyNames(
      TransportOfficersController.prototype,
    )
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual(
      ['list', 'candidates', 'add', 'deactivate', 'activate'].sort(),
    );
  });
});
