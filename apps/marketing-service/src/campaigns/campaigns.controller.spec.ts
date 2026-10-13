import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { CampaignsController } from './campaigns.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

describe('CampaignsController authorization contract', () => {
  it('requires the marketing module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, CampaignsController)).toBe(
      'marketing',
    );
  });

  it.each([
    ['list', P.CAMPAIGNS_VIEW],
    ['get', P.CAMPAIGNS_VIEW],
    ['recipientOptions', P.CAMPAIGNS_CREATE],
    ['preview', P.CAMPAIGNS_CREATE],
    ['estimate', P.CAMPAIGNS_CREATE],
    ['create', P.CAMPAIGNS_CREATE],
    ['update', P.CAMPAIGNS_CREATE],
    ['send', P.CAMPAIGNS_SEND],
    ['cancel', P.CAMPAIGNS_CANCEL],
  ] as const)('gates %s behind %s', (method, permission) => {
    expect(anyPermissions(CampaignsController.prototype[method])).toEqual([
      permission,
    ]);
  });

  it('leaves no route handler ungated', () => {
    const declared = Object.getOwnPropertyNames(CampaignsController.prototype)
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual(
      [
        'list',
        'get',
        'recipientOptions',
        'preview',
        'estimate',
        'create',
        'update',
        'send',
        'cancel',
      ].sort(),
    );
  });
});
