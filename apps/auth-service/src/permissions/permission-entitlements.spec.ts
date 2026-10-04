import { isResourceEnabledForTenant } from './permission-entitlements';

describe('permission entitlements', () => {
  const marketingEnabledConfig = {
    moduleConfig: { marketing: true },
    featureConfig: { marketing: { leads: true } },
  };
  const marketingDisabledFeatureConfig = {
    moduleConfig: { marketing: true },
    featureConfig: { marketing: { leads: false } },
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
    'marketing.fleet',
    'marketing.requests',
    'marketing.requests.all',
    'marketing.appointments.all',
    'marketing.transport-officers',
    'marketing.campaigns',
  ])('scopes %s to the Marketing module only', (name) => {
    const resource = { name, module: 'MARKETING' };

    expect(isResourceEnabledForTenant(resource, marketingEnabledConfig)).toBe(
      true,
    );
    expect(
      isResourceEnabledForTenant(resource, marketingDisabledFeatureConfig),
    ).toBe(true);
    expect(
      isResourceEnabledForTenant(resource, {
        moduleConfig: { marketing: false },
        featureConfig: { marketing: { leads: true } },
      }),
    ).toBe(false);
  });
});
