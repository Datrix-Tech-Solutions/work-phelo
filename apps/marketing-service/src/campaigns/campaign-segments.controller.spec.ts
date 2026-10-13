import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { CampaignSegmentsController } from './campaign-segments.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

describe('CampaignSegmentsController authorization contract', () => {
  it('requires the marketing module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, CampaignSegmentsController)).toBe(
      'marketing',
    );
  });

  it.each([
    ['list', [P.CAMPAIGNS_VIEW, P.CAMPAIGNS_CREATE]],
    ['count', [P.CAMPAIGNS_CREATE]],
    ['create', [P.CAMPAIGNS_CREATE]],
    ['update', [P.CAMPAIGNS_CREATE]],
    ['remove', [P.CAMPAIGNS_CREATE]],
  ] as const)('gates %s behind %j', (method, permissions) => {
    expect(
      anyPermissions(CampaignSegmentsController.prototype[method]),
    ).toEqual(permissions);
  });

  it('leaves no route handler ungated', () => {
    const declared = Object.getOwnPropertyNames(
      CampaignSegmentsController.prototype,
    )
      .filter((name) => name !== 'constructor')
      .sort();
    expect(declared).toEqual(
      ['list', 'count', 'create', 'update', 'remove'].sort(),
    );
  });
});
