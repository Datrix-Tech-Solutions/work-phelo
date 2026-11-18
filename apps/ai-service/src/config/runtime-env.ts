export interface AiRuntimeConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  AI_PROVIDER: 'mock';
  AI_ENABLED: boolean;
  AI_MOCK_ENABLED: boolean;
  AI_SERVICE_PORT: number;
  AI_REQUEST_TIMEOUT_MS: number;
  AI_POLICY_VERSION: string;
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
  // Neither flag can enable mock execution in a production process.
  if (nodeEnv === 'production' && (enabled || mockEnabled)) {
    throw new RuntimeConfigurationError('AI_ENABLED/AI_MOCK_ENABLED');
  }
  return {
    NODE_ENV: nodeEnv as AiRuntimeConfig['NODE_ENV'],
    AI_PROVIDER: 'mock',
    AI_ENABLED: enabled,
    AI_MOCK_ENABLED: mockEnabled,
    AI_SERVICE_PORT: integerValue(env, 'AI_SERVICE_PORT', 4011, 65535),
    AI_REQUEST_TIMEOUT_MS: integerValue(env, 'AI_REQUEST_TIMEOUT_MS', 5000, 25000),
    AI_POLICY_VERSION: policy,
  };
}
