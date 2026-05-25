export const reinsuranceRequiredEnvVars = ['DATABASE_URL'] as const;

export function assertReinsuranceRuntimeEnv(): void {
  const missing = reinsuranceRequiredEnvVars.filter(
    (name) => !process.env[name],
  );

  if (missing.length > 0) {
    throw new Error(
      `Reinsurance service missing required environment variables: ${missing.join(', ')}`,
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
