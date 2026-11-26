import { KeyRingConfigurationError, parseEncryptionKeys } from '../encryption/key-ring.config';
import { parseFingerprintKeys } from '../persistence/submission-fingerprint.service';
import { parseVerificationKeys } from '../request-integrity/verification-keys';

export interface AiRuntimeConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  AI_PROVIDER: 'mock';
  AI_ENABLED: boolean;
  AI_MOCK_ENABLED: boolean;
  AI_INTERNAL_DEMO_ENABLED: boolean;
  AI_RUNTIME_SCOPE?: 'isolated-demo';
  AI_SERVICE_PORT: number;
  AI_REQUEST_TIMEOUT_MS: number;
  AI_POLICY_VERSION: string;
  AI_AUTHENTICATED_ROUTES_ENABLED: boolean;
  JWT_SECRET?: string;
  AI_PERSISTENCE_ENABLED: boolean;
  DATABASE_URL?: string;
  AI_MESSAGE_ENCRYPTION_ENABLED: boolean;
  AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID?: string;
  AI_MESSAGE_ENCRYPTION_KEYS?: string;
  AI_MESSAGE_OPERATIONS_ENABLED: boolean;
  AI_FINGERPRINT_ACTIVE_KEY_ID?: string;
  AI_FINGERPRINT_KEYS?: string;
  AI_RETENTION_CLEANUP_ENABLED: boolean;
  AI_RETENTION_SCHEDULER_ENABLED: boolean;
  AI_CLEANUP_BATCH_SIZE: number;
  AI_CLEANUP_RECEIPT_BATCH_SIZE: number;
  AI_CLEANUP_NONCE_BATCH_SIZE: number;
  AI_CLEANUP_INTERVAL_MS: number;
  AI_REQUEST_VERIFICATION_ENABLED: boolean;
  AI_REQUEST_VERIFICATION_KEYS?: string;
  AI_CONVERSATION_HTTP_ENABLED: boolean;
  AI_RESOURCE_SAFEGUARDS_ENABLED: boolean;
  AI_METADATA_OWNER_RECEIPT_LIMIT: number;
  AI_METADATA_TENANT_RECEIPT_LIMIT: number;
  AI_METADATA_OWNER_NONCE_LIMIT: number;
  AI_METADATA_TENANT_NONCE_LIMIT: number;
  AI_METADATA_BACKLOG_GRACE_SECONDS: number;
}

export class RuntimeConfigurationError extends Error {
  constructor(name: string) {
    super(`Invalid or missing AI runtime configuration: ${name}`);
    this.name = 'RuntimeConfigurationError';
  }
}

function booleanValue(env: Record<string, unknown>, name: string): boolean {
  const value = env[name];
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new RuntimeConfigurationError(name);
}

function integerValue(
  env: Record<string, unknown>,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value = env[name];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim() !== value || !/^[1-9]\d*$/.test(value)) {
    throw new RuntimeConfigurationError(name);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new RuntimeConfigurationError(name);
  }
  return parsed;
}

export function parseRuntimeEnv(env: Record<string, unknown>): AiRuntimeConfig {
  const nodeEnv = env.NODE_ENV;
  if (typeof nodeEnv !== 'string' || !['development', 'test', 'production'].includes(nodeEnv)) {
    throw new RuntimeConfigurationError('NODE_ENV');
  }
  if (env.AI_PROVIDER !== 'mock') {
    throw new RuntimeConfigurationError('AI_PROVIDER');
  }
  const policy = env.AI_POLICY_VERSION;
  if (
    typeof policy !== 'string' ||
    policy.trim() !== policy ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(policy)
  ) {
    throw new RuntimeConfigurationError('AI_POLICY_VERSION');
  }
  const enabled = booleanValue(env, 'AI_ENABLED');
  const mockEnabled = booleanValue(env, 'AI_MOCK_ENABLED');
  const authenticatedRoutes = booleanValue(env, 'AI_AUTHENTICATED_ROUTES_ENABLED');
  const secret = env.JWT_SECRET;
  const persistenceEnabled = booleanValue(env, 'AI_PERSISTENCE_ENABLED');
  const encryptionEnabled = booleanValue(env, 'AI_MESSAGE_ENCRYPTION_ENABLED');
  const operationsEnabled = booleanValue(env, 'AI_MESSAGE_OPERATIONS_ENABLED');
  const cleanupEnabled = booleanValue(env, 'AI_RETENTION_CLEANUP_ENABLED');
  const schedulerEnabled = booleanValue(env, 'AI_RETENTION_SCHEDULER_ENABLED');
  const verificationEnabled = booleanValue(env, 'AI_REQUEST_VERIFICATION_ENABLED');
  const conversationHttpEnabled = booleanValue(env, 'AI_CONVERSATION_HTTP_ENABLED');
  const demoEnabled = booleanValue(env, 'AI_INTERNAL_DEMO_ENABLED');
  if (
    demoEnabled &&
    (nodeEnv === 'production' ||
      env.AI_RUNTIME_SCOPE !== 'isolated-demo' ||
      !enabled ||
      !mockEnabled ||
      !conversationHttpEnabled)
  )
    throw new RuntimeConfigurationError('AI_INTERNAL_DEMO_ENABLED/AI_RUNTIME_SCOPE');
  const safeguards = booleanValue(env, 'AI_RESOURCE_SAFEGUARDS_ENABLED');
  if (safeguards && !persistenceEnabled)
    throw new RuntimeConfigurationError('AI_RESOURCE_SAFEGUARDS_ENABLED');
  if (
    conversationHttpEnabled &&
    (nodeEnv === 'production' ||
      !safeguards ||
      !authenticatedRoutes ||
      !persistenceEnabled ||
      !encryptionEnabled ||
      !operationsEnabled ||
      !verificationEnabled)
  )
    throw new RuntimeConfigurationError('AI_CONVERSATION_HTTP_ENABLED');
  if (verificationEnabled) {
    if (!persistenceEnabled || !authenticatedRoutes)
      throw new RuntimeConfigurationError('AI_REQUEST_VERIFICATION_ENABLED');
    try {
      for (const key of parseVerificationKeys(env)) key.material.fill(0);
    } catch {
      throw new RuntimeConfigurationError('AI_REQUEST_VERIFICATION_KEYS');
    }
  }
  if (
    (cleanupEnabled && (!persistenceEnabled || nodeEnv === 'production')) ||
    (schedulerEnabled && !cleanupEnabled)
  )
    throw new RuntimeConfigurationError(
      'AI_RETENTION_CLEANUP_ENABLED/AI_RETENTION_SCHEDULER_ENABLED',
    );
  const cleanupInterval = integerValue(env, 'AI_CLEANUP_INTERVAL_MS', 60000, 3600000);
  if (cleanupInterval < 1000) throw new RuntimeConfigurationError('AI_CLEANUP_INTERVAL_MS');
  if (operationsEnabled) {
    if (!persistenceEnabled || !encryptionEnabled)
      throw new RuntimeConfigurationError('AI_MESSAGE_OPERATIONS_ENABLED');
    try {
      const parsed = parseFingerprintKeys(env);
      for (const { material } of parsed.keys) material.fill(0);
    } catch {
      throw new RuntimeConfigurationError('AI_FINGERPRINT_KEYS/AI_FINGERPRINT_ACTIVE_KEY_ID');
    }
  }
  if (encryptionEnabled) {
    try {
      const parsed = parseEncryptionKeys(env);
      for (const { material } of parsed.keys) material.fill(0);
    } catch (error) {
      throw new RuntimeConfigurationError(
        error instanceof KeyRingConfigurationError ? error.field : 'AI_MESSAGE_ENCRYPTION_KEYS',
      );
    }
  }
  if (persistenceEnabled) {
    try {
      if (typeof env.DATABASE_URL !== 'string') throw new Error();
      const url = new URL(env.DATABASE_URL);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        !url.username ||
        url.pathname.length < 2 ||
        url.searchParams.getAll('schema').length !== 1 ||
        url.searchParams.get('schema') !== 'ai' ||
        url.searchParams.has('options')
      )
        throw new Error();
    } catch {
      throw new RuntimeConfigurationError('DATABASE_URL');
    }
  }
  if (
    authenticatedRoutes &&
    (typeof secret !== 'string' || !secret.trim() || secret !== secret.trim())
  ) {
    throw new RuntimeConfigurationError('JWT_SECRET');
  }
  // Neither flag can enable mock execution in a production process.
  if (nodeEnv === 'production' && (enabled || mockEnabled)) {
    throw new RuntimeConfigurationError('AI_ENABLED/AI_MOCK_ENABLED');
  }
  return {
    NODE_ENV: nodeEnv as AiRuntimeConfig['NODE_ENV'],
    AI_PROVIDER: 'mock',
    AI_ENABLED: enabled,
    AI_MOCK_ENABLED: mockEnabled,
    AI_INTERNAL_DEMO_ENABLED: demoEnabled,
    ...(demoEnabled ? { AI_RUNTIME_SCOPE: 'isolated-demo' as const } : {}),
    AI_SERVICE_PORT: integerValue(env, 'AI_SERVICE_PORT', 4011, 65535),
    AI_REQUEST_TIMEOUT_MS: integerValue(env, 'AI_REQUEST_TIMEOUT_MS', 5000, 25000),
    AI_POLICY_VERSION: policy,
    AI_AUTHENTICATED_ROUTES_ENABLED: authenticatedRoutes,
    ...(authenticatedRoutes ? { JWT_SECRET: secret as string } : {}),
    AI_PERSISTENCE_ENABLED: persistenceEnabled,
    ...(persistenceEnabled ? { DATABASE_URL: env.DATABASE_URL as string } : {}),
    AI_MESSAGE_ENCRYPTION_ENABLED: encryptionEnabled,
    AI_MESSAGE_OPERATIONS_ENABLED: operationsEnabled,
    AI_RETENTION_CLEANUP_ENABLED: cleanupEnabled,
    AI_RETENTION_SCHEDULER_ENABLED: schedulerEnabled,
    AI_REQUEST_VERIFICATION_ENABLED: verificationEnabled,
    AI_CONVERSATION_HTTP_ENABLED: conversationHttpEnabled,
    AI_RESOURCE_SAFEGUARDS_ENABLED: safeguards,
    AI_METADATA_OWNER_RECEIPT_LIMIT: integerValue(
      env,
      'AI_METADATA_OWNER_RECEIPT_LIMIT',
      432002,
      432002,
    ),
    AI_METADATA_TENANT_RECEIPT_LIMIT: integerValue(
      env,
      'AI_METADATA_TENANT_RECEIPT_LIMIT',
      4320020,
      4320020,
    ),
    AI_METADATA_OWNER_NONCE_LIMIT: integerValue(env, 'AI_METADATA_OWNER_NONCE_LIMIT', 256, 256),
    AI_METADATA_TENANT_NONCE_LIMIT: integerValue(env, 'AI_METADATA_TENANT_NONCE_LIMIT', 4096, 4096),
    AI_METADATA_BACKLOG_GRACE_SECONDS: integerValue(
      env,
      'AI_METADATA_BACKLOG_GRACE_SECONDS',
      120,
      3600,
    ),
    ...(verificationEnabled
      ? { AI_REQUEST_VERIFICATION_KEYS: env.AI_REQUEST_VERIFICATION_KEYS as string }
      : {}),
    AI_CLEANUP_BATCH_SIZE: integerValue(env, 'AI_CLEANUP_BATCH_SIZE', 25, 100),
    AI_CLEANUP_RECEIPT_BATCH_SIZE: integerValue(
      env,
      'AI_CLEANUP_RECEIPT_BATCH_SIZE',
      integerValue(env, 'AI_CLEANUP_BATCH_SIZE', 25, 100),
      100,
    ),
    AI_CLEANUP_NONCE_BATCH_SIZE: integerValue(
      env,
      'AI_CLEANUP_NONCE_BATCH_SIZE',
      integerValue(env, 'AI_CLEANUP_BATCH_SIZE', 25, 100),
      1000,
    ),
    AI_CLEANUP_INTERVAL_MS: cleanupInterval,
    ...(operationsEnabled
      ? {
          AI_FINGERPRINT_ACTIVE_KEY_ID: env.AI_FINGERPRINT_ACTIVE_KEY_ID as string,
          AI_FINGERPRINT_KEYS: env.AI_FINGERPRINT_KEYS as string,
        }
      : {}),
    ...(encryptionEnabled
      ? {
          AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: env.AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID as string,
          AI_MESSAGE_ENCRYPTION_KEYS: env.AI_MESSAGE_ENCRYPTION_KEYS as string,
        }
      : {}),
  };
}
