export const notificationRequiredEnvVars = [
  'DATABASE_URL',
  'RABBITMQ_URL',
  'JWT_SECRET',
  'FRONTEND_BASE_URL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
] as const;

export function assertNotificationRuntimeEnv(): void {
  const smsProvider = (process.env.SMS_PROVIDER ?? 'termii')
    .trim()
    .toLowerCase();

  if (
    smsProvider !== 'termii' &&
    smsProvider !== 'pilosms' &&
    smsProvider !== 'sasusync' &&
    smsProvider !== 'agoosms'
  ) {
    throw new Error(
      `Unsupported SMS_PROVIDER "${process.env.SMS_PROVIDER}". Expected "termii", "pilosms", "sasusync", or "agoosms".`,
    );
  }

  const providerRequiredEnvVars = providerEnvVars(smsProvider);
  const missing = [
    ...notificationRequiredEnvVars,
    ...providerRequiredEnvVars,
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Notification service missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

function providerEnvVars(smsProvider: string): string[] {
  if (smsProvider === 'termii') {
    return ['TERMII_API_KEY', 'TERMII_SENDER_ID'];
  }

  if (smsProvider === 'pilosms') {
    return ['PILOSMS_API_KEY', 'PILOSMS_SENDER_ID'];
  }

  if (smsProvider === 'sasusync') {
    return ['SASUSYNC_API_KEY', 'SASUSYNC_SENDER_ID'];
  }

  if (smsProvider === 'agoosms') {
    return ['AGOOSMS_API_KEY'];
  }

  return [];
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
