import { isResourceEnabledForTenant } from './permission-entitlements';

describe('permission entitlements', () => {
  const marketingEnabledConfig = {
    moduleConfig: { marketing: true },
    featureConfig: { marketing: { 'sales-crm': true } },
  };
  const marketingDisabledFeatureConfig = {
    moduleConfig: { marketing: true },
    featureConfig: { marketing: { 'sales-crm': false } },
  };
  const enabledConfig = {
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
  };
  const disabledFeatureConfig = {
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: false } },
  };

  it.each([
    'operations.reinsurance.facultative-offers.create-offer',
    'operations.reinsurance.facultative-offers.edit-offer',
    'operations.reinsurance.facultative-offers.partial-edit',
    'operations.reinsurance.facultative-offers.reopen-offer',
    'operations.reinsurance.facultative-offers.force-close',
    'operations.reinsurance.facultative-offers.endorse-offer',
    'operations.reinsurance.facultative-offers.archive-offer',
    'operations.reinsurance.premiums.receive-from-cedant',
    'operations.reinsurance.premiums.disburse-to-reinsurer',
    'operations.reinsurance.premiums.reverse-payment',
    'operations.reinsurance.claims.add-claim',
    'operations.reinsurance.claims.create-notification',
    'operations.reinsurance.claims.record-recovery',
    'operations.reinsurance.claims.void-claim',
  ])('scopes %s to the Reinsurance feature entitlement', (name) => {
    const resource = { name, module: 'OPERATIONS' };

    expect(isResourceEnabledForTenant(resource, enabledConfig)).toBe(true);
    expect(isResourceEnabledForTenant(resource, disabledFeatureConfig)).toBe(
      false,
    );
  });

  it.each([
    'marketing.prospects',
    'marketing.prospects.all',
    'marketing.clients',
    'marketing.clients.all',
    'marketing.clients.billing',
    'marketing.targets',
    'marketing.targets.all',
    'marketing.prospects.interactions',
    'marketing.prospects.interactions.all',
    'marketing.follow-ups',
    'marketing.follow-ups.all',
  ])('scopes %s to the Marketing leads feature entitlement', (name) => {
    const resource = { name, module: 'MARKETING' };

    expect(isResourceEnabledForTenant(resource, marketingEnabledConfig)).toBe(
      true,
    );
    expect(
      isResourceEnabledForTenant(resource, marketingDisabledFeatureConfig),
    ).toBe(false);
  });

  it.each([
    ['campaign', 'marketing.campaigns'],
    ['campaign', 'marketing.sms-sender-identities'],
    ['campaign', 'marketing.domains'],
    ['campaign', 'marketing.sms-wallet'],
    ['campaign', 'marketing.sms-credits'],
    ['transport', 'marketing.fleet'],
    ['transport', 'marketing.requests'],
    ['transport', 'marketing.requests.all'],
    ['transport', 'marketing.transport-officers'],
  ])('scopes the %s feature entitlement to %s', (feature, name) => {
    const resource = { name, module: 'MARKETING' };

    expect(
      isResourceEnabledForTenant(resource, {
        moduleConfig: { marketing: true },
        featureConfig: { marketing: { [feature]: true } },
      }),
    ).toBe(true);
    expect(
      isResourceEnabledForTenant(resource, {
        moduleConfig: { marketing: true },
        featureConfig: { marketing: { [feature]: false } },
      }),
    ).toBe(false);
  });

  it('scopes appointments to the Marketing module only', () => {
    const resource = {
      name: 'marketing.appointments.all',
      module: 'MARKETING',
    };

    expect(isResourceEnabledForTenant(resource, marketingEnabledConfig)).toBe(
      true,
    );
    expect(
      isResourceEnabledForTenant(resource, marketingDisabledFeatureConfig),
    ).toBe(true);
    expect(
      isResourceEnabledForTenant(resource, {
        moduleConfig: { marketing: false },
        featureConfig: { marketing: { 'sales-crm': true } },
      }),
    ).toBe(false);
  });
});
