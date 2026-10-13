import {
  parseSmsSenderProviderStatusMaxAgeHours,
  parseSmsSenderReadinessMode,
} from '../sms/sms-sender-readiness';

export const marketingRequiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function assertMarketingRuntimeEnv(): void {
  const missing = marketingRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Marketing service missing required environment variables: ${missing.join(', ')}`,
    );
  }

  parseSmsSenderReadinessMode();
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
