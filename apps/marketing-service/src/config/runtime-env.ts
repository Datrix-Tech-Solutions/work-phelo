import {
  parseSmsSenderProviderStatusMaxAgeHours,
  parseSmsSenderReadinessMode,
} from '../sms/sms-sender-readiness';
import { marketingActivation, marketingActivationFlags } from './activation';

export const marketingRequiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function assertMarketingRuntimeEnv(): void {
  for (const flag of marketingActivationFlags) marketingActivation(flag);
  if (
    marketingActivation('MARKETING_RABBITMQ_CONSUMER_ENABLED') &&
    !process.env.RABBITMQ_URL
  ) {
    throw new Error(
      'RABBITMQ_URL is required when Marketing consumers are enabled',
    );
  }
  const missing = marketingRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Marketing service missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const mode = parseSmsSenderReadinessMode();
  if (
    process.env.NODE_ENV === 'production' &&
    marketingActivation('MARKETING_OUTBOUND_COMMUNICATION_ENABLED') &&
    mode !== 'strict'
  ) {
    throw new Error(
      'Production Marketing outbound communication requires strict sender readiness',
    );
  }
  parseSmsSenderProviderStatusMaxAgeHours();
}

if (require.main === module) {
  try {
    assertMarketingRuntimeEnv();
    console.log('Marketing service environment validation passed');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Marketing environment validation failed';
    console.error(message);
    process.exit(1);
  }
}
