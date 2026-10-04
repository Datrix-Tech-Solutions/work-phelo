import { SourceModule } from '../../../prisma/generated/client';

/**
 * A module that raises transactions in Accounting on behalf of its own records (e.g. Marketing
 * billing a client). Adding another module is one entry here: Accounting provisions its source, and
 * everything else - creating the entity and the draft, history, receipts, the callback - works from
 * this description. Entity types are never provisioned: the accountant creates their own (or uses
 * an existing one) and names it on the transaction types linked to the source.
 */
export interface SourceRegistration {
  module: SourceModule;
  /** The key the tenant's module config uses (`moduleConfig[moduleConfigKey]`). */
  moduleConfigKey: string;
  /** Shown on the Source Types page. */
  sourceName: string;
  /** The one service allowed to raise transactions for this module. */
  serviceName: string;
  /** Where Accounting reports what happened to a transaction (the module's own service). */
  callback?: { baseUrlEnv: string; path: string };
}

export const SOURCE_REGISTRY: Partial<
  Record<SourceModule, SourceRegistration>
> = {
  MARKETING: {
    module: 'MARKETING',
    moduleConfigKey: 'marketing',
    sourceName: 'Client Billing',
    serviceName: 'marketing-service',
    callback: {
      baseUrlEnv: 'MARKETING_SERVICE_URL',
      path: '/internal/accounting-events',
    },
  },
};

export function registrationFor(
  module: string,
): SourceRegistration | undefined {
  return SOURCE_REGISTRY[module as SourceModule];
}
