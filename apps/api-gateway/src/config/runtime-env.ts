export const gatewayRequiredEnvVars = [
  'JWT_SECRET',
  'AUTH_SERVICE_URL',
  'HR_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
] as const;

export const gatewayOptionalServiceEnvVars = [
  'SUBSCRIPTION_SERVICE_URL',
  'MARKETING_SERVICE_URL',
  'REINSURANCE_SERVICE_URL',
  'ACCOUNTING_SERVICE_URL',
  'INVENTORY_SERVICE_URL',
  'AI_SERVICE_URL',
] as const;

const allGatewayEnvVars = [
  ...gatewayRequiredEnvVars,
  ...gatewayOptionalServiceEnvVars,
] as const;

export type GatewayServiceName =
  | 'auth'
  | 'hr'
  | 'notification'
  | 'subscription'
  | 'marketing'
  | 'reinsurance'
  | 'accounting'
  | 'inventory'
  | 'ai';

export const gatewayRequiredServices: GatewayServiceName[] = [
  'auth',
  'hr',
  'notification',
];

export const gatewayOptionalServices: GatewayServiceName[] = [
  'subscription',
  'marketing',
  'reinsurance',
  'accounting',
  'inventory',
  'ai',
];

export const gatewayServiceConfig: Record<
  GatewayServiceName,
  {
    envVar: (typeof allGatewayEnvVars)[number];
    healthPath: string;
    downstreamPrefix?: string;
  }
> = {
  auth: { envVar: 'AUTH_SERVICE_URL', healthPath: '/health' },
  hr: { envVar: 'HR_SERVICE_URL', healthPath: '/health' },
  notification: {
    envVar: 'NOTIFICATION_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  subscription: {
    envVar: 'SUBSCRIPTION_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  marketing: {
    envVar: 'MARKETING_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  reinsurance: {
    envVar: 'REINSURANCE_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  accounting: {
    envVar: 'ACCOUNTING_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  inventory: {
    envVar: 'INVENTORY_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
  ai: {
    envVar: 'AI_SERVICE_URL',
    healthPath: '/api/health',
    downstreamPrefix: '/api',
  },
};

export function assertGatewayRuntimeEnv(): void {
  const missing = gatewayRequiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `API gateway missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

export function getGatewayServiceUrl(
  serviceName: GatewayServiceName,
): string | undefined {
  const value = process.env[gatewayServiceConfig[serviceName].envVar];
  if (serviceName !== 'ai' || !value) return value;

  // Invalid optional AI configuration disables only AI, never ordinary ERP startup.
  try {
    const url = new URL(value);
    if (
      value !== value.trim() ||
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export function getConfiguredGatewayServices(): Partial<
  Record<GatewayServiceName, string>
> {
  return Object.keys(gatewayServiceConfig).reduce(
    (services, serviceName) => {
      const value = getGatewayServiceUrl(serviceName as GatewayServiceName);
      if (value) {
        services[serviceName as GatewayServiceName] = value;
      }
      return services;
    },
    {} as Partial<Record<GatewayServiceName, string>>,
  );
}

if (require.main === module) {
  try {
    assertGatewayRuntimeEnv();
    console.log('API gateway environment validation passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
