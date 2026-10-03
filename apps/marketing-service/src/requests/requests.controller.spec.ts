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
    ['list', [P.REQUESTS_VIEW, P.REQUESTS_VIEW_ALL]],
    ['findOne', [P.REQUESTS_VIEW, P.REQUESTS_VIEW_ALL]],
    ['formOptions', [P.REQUESTS_CREATE, P.REQUESTS_EDIT]],
    ['create', [P.REQUESTS_CREATE]],
    ['update', [P.REQUESTS_EDIT]],
    ['cancel', [P.REQUESTS_CANCEL]],
    ['allocationOptions', [P.REQUESTS_APPROVE_ALL]],
    ['approve', [P.REQUESTS_APPROVE_ALL]],
    ['reject', [P.REQUESTS_APPROVE_ALL]],
  ] as const)('gates %s behind %j', (method, permissions) => {
    expect(anyPermissions(RequestsController.prototype[method])).toEqual(
      permissions,
    );
  });

  it('leaves no route handler ungated', () => {
    const declared = Object.getOwnPropertyNames(RequestsController.prototype)
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual(
      [
        'list',
        'formOptions',
        'findOne',
        'allocationOptions',
        'create',
        'update',
        'cancel',
        'approve',
        'reject',
      ].sort(),
    );
  });
});
