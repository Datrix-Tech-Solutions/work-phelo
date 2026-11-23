import { ServiceUnavailableException } from '@nestjs/common';

export function accountingActivation(name: string): boolean {
  const value = process.env[name];
  if (value !== undefined && value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be true or false`);
  }
  return value === undefined
    ? process.env.NODE_ENV !== 'production'
    : value === 'true';
}

export function requireAccountingInternalIntegration(): void {
  if (!accountingActivation('ACCOUNTING_INTERNAL_INTEGRATION_ENABLED')) {
    throw new ServiceUnavailableException(
      'Accounting internal integrations are disabled',
    );
  }
}
