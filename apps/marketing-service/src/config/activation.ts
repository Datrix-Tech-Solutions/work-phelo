import { ServiceUnavailableException } from '@nestjs/common';

export const marketingActivationFlags = [
  'MARKETING_OUTBOUND_COMMUNICATION_ENABLED',
  'MARKETING_AUTOMATIC_PROCESSING_ENABLED',
  'MARKETING_RABBITMQ_CONSUMER_ENABLED',
  'MARKETING_ACCOUNTING_INTEGRATION_ENABLED',
] as const;

export function marketingActivation(
  name: (typeof marketingActivationFlags)[number],
): boolean {
  const value = process.env[name];
  if (value !== undefined && value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be true or false`);
  }
  if (value !== undefined) return value === 'true';
  return (
    process.env.NODE_ENV !== 'production' &&
    (name !== 'MARKETING_RABBITMQ_CONSUMER_ENABLED' ||
      Boolean(process.env.RABBITMQ_URL))
  );
}

export function requireMarketingOutbound(): void {
  if (!marketingActivation('MARKETING_OUTBOUND_COMMUNICATION_ENABLED')) {
    throw new ServiceUnavailableException(
      'Marketing outbound communication is disabled',
    );
  }
}

export function marketingScheduledDispatchEnabled(): boolean {
  return (
    marketingActivation('MARKETING_AUTOMATIC_PROCESSING_ENABLED') &&
    marketingActivation('MARKETING_OUTBOUND_COMMUNICATION_ENABLED')
  );
}

export function requireMarketingAccounting(): void {
  if (!marketingActivation('MARKETING_ACCOUNTING_INTEGRATION_ENABLED')) {
    throw new ServiceUnavailableException(
      'Marketing Accounting integration is disabled',
    );
  }
}
