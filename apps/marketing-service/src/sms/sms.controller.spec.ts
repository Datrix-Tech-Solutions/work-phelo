import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { SmsSenderIdentitiesController } from './sms-sender-identities.controller';
import { SmsWalletController } from './sms-wallet.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[] | undefined;

describe('SMS foundation controller authorization contracts', () => {
  it('requires the marketing module for sender identities', () => {
    expect(Reflect.getMetadata(MODULE_KEY, SmsSenderIdentitiesController)).toBe(
      'marketing',
    );
  });

  it.each([
    ['list', P.SMS_SENDER_IDENTITIES_VIEW],
    ['findOne', P.SMS_SENDER_IDENTITIES_VIEW],
    ['create', P.SMS_SENDER_IDENTITIES_CREATE],
    ['update', P.SMS_SENDER_IDENTITIES_EDIT],
    ['archive', P.SMS_SENDER_IDENTITIES_DELETE],
    ['submit', P.SMS_SENDER_IDENTITIES_SUBMIT],
    ['approve', P.SMS_SENDER_IDENTITIES_APPROVE],
    ['reject', P.SMS_SENDER_IDENTITIES_APPROVE],
    ['setDefault', P.SMS_SENDER_IDENTITIES_EDIT],
  ] as const)('gates sender %s behind %s', (method, permission) => {
    expect(
      anyPermissions(SmsSenderIdentitiesController.prototype[method]),
    ).toEqual([permission]);
  });

  it('requires the marketing module for wallet endpoints', () => {
    expect(Reflect.getMetadata(MODULE_KEY, SmsWalletController)).toBe(
      'marketing',
    );
  });

  it.each([
    ['getBalance', P.SMS_WALLET_VIEW],
    ['listLedger', P.SMS_WALLET_VIEW],
    ['grant', P.SMS_CREDITS_ADJUST],
  ] as const)('gates wallet %s behind %s', (method, permission) => {
    expect(anyPermissions(SmsWalletController.prototype[method])).toEqual([
      permission,
    ]);
  });
});
