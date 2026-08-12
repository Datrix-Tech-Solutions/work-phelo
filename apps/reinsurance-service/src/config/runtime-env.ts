export const reinsuranceRequiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RABBITMQ_URL',
] as const;

export const reinsuranceAccountingIntegrationRequiredEnvVars = [
  'ACCOUNTING_SERVICE_URL',
  'INTERNAL_SERVICE_AUTH_SECRET',
] as const;

export function assertReinsuranceRuntimeEnv(): void {
  const required = [
    ...reinsuranceRequiredEnvVars,
    ...(isAccountingIntegrationExpected()
      ? reinsuranceAccountingIntegrationRequiredEnvVars
      : []),
  ];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Reinsurance service missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (isAccountingIntegrationExpected()) {
    assertAccountingServiceUrl();
    assertInternalServiceAuthSecret();
  }
}

function isAccountingIntegrationExpected(): boolean {
  if (process.env.REINSURANCE_ACCOUNTING_INTEGRATION_ENABLED === 'false') {
    return false;
  }
  return (
    process.env.NODE_ENV === 'production' || Boolean(process.env.DEPLOY_ENV)
  );
}

function assertAccountingServiceUrl(): void {
  const value = process.env.ACCOUNTING_SERVICE_URL?.trim();
  try {
    if (!value) throw new Error('missing');
    new URL(value);
  } catch {
    throw new Error(
      'Reinsurance service ACCOUNTING_SERVICE_URL must be a valid URL when Accounting integration is enabled',
    );
  }
}

function assertInternalServiceAuthSecret(): void {
  const value = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      'Reinsurance service INTERNAL_SERVICE_AUTH_SECRET must be at least 32 characters when Accounting integration is enabled',
    );
  }
}

if (require.main === module) {
  try {
    assertReinsuranceRuntimeEnv();
    console.log('Reinsurance service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
