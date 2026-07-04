export const accountingRequiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

export function assertAccountingRuntimeEnv(): void {
  const missing = accountingRequiredEnvVars.filter(
    (name) => !process.env[name],
  );

  if (missing.length > 0) {
    throw new Error(
      `Accounting service missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

if (require.main === module) {
  try {
    assertAccountingRuntimeEnv();
    console.log('Accounting service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
