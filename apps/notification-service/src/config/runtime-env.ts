export const notificationRequiredEnvVars = [
  'DATABASE_URL',
  'RABBITMQ_URL',
  'JWT_SECRET',
  'FRONTEND_BASE_URL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'TERMII_API_KEY',
] as const;

export function assertNotificationRuntimeEnv(): void {
  const missing = notificationRequiredEnvVars.filter(
    (name) => !process.env[name],
  );

  if (missing.length > 0) {
    throw new Error(
      `Notification service missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

if (require.main === module) {
  try {
    assertNotificationRuntimeEnv();
    console.log('Notification service environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
