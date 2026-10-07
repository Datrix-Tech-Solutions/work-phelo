import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { RequestsController } from './requests.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

describe('RequestsController authorization contract', () => {
  it('requires the marketing module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, RequestsController)).toBe(
      'marketing',
    );
  });

  it.each([
    'list',
    'findOne',
    'formOptions',
    'destinationOptions',
    'create',
    'update',
    'cancel',
    'complete',
    'start',
    'startOptions',
  ] as const)(
    'leaves %s open to everyone: the service limits it to their own requests',
    (method) => {
      expect(
        anyPermissions(RequestsController.prototype[method]),
      ).toBeUndefined();
    },
  );

  it.each([
    ['reschedule', [P.REQUESTS_APPROVE_ALL]],
    ['allocationOptions', [P.REQUESTS_APPROVE_ALL]],
    ['approve', [P.REQUESTS_APPROVE_ALL]],
    ['reject', [P.REQUESTS_APPROVE_ALL]],
  ] as const)('gates %s behind %j', (method, permissions) => {
    expect(anyPermissions(RequestsController.prototype[method])).toEqual(
      permissions,
    );
  });

  it('lists every route handler', () => {
    const declared = Object.getOwnPropertyNames(RequestsController.prototype)
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual(
      [
        'list',
        'formOptions',
        'destinationOptions',
        'findOne',
        'allocationOptions',
        'create',
        'update',
        'cancel',
        'complete',
        'start',
        'startOptions',
        'reschedule',
        'approve',
        'reject',
      ].sort(),
    );
  });
});
