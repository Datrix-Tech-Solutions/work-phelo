import {
  assertGatewayRuntimeEnv,
  gatewayOptionalServices,
  gatewayRequiredServices,
  gatewayServiceConfig,
  getConfiguredGatewayServices,
  getGatewayServiceUrl,
} from './runtime-env';

describe('Optional AI Gateway configuration', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'gateway-config-test-secret';
    process.env.AUTH_SERVICE_URL = 'http://auth.test:4001';
    process.env.HR_SERVICE_URL = 'http://hr.test:4002';
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification.test:4004';
    delete process.env.AI_SERVICE_URL;
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it('registers AI with the established prefix and optional health convention', () => {
    expect(gatewayOptionalServices).toContain('ai');
    expect(gatewayRequiredServices).not.toContain('ai');
    expect(gatewayServiceConfig.ai).toEqual({
      envVar: 'AI_SERVICE_URL',
      healthPath: '/api/health',
      downstreamPrefix: '/api',
    });
    expect(() => assertGatewayRuntimeEnv()).not.toThrow();
    expect(getConfiguredGatewayServices()).not.toHaveProperty('ai');
  });

  it.each(['http://ai-service:4011', 'https://ai.internal.test/'])(
    'accepts a configured HTTP(S) service origin: %s',
    (url) => {
      process.env.AI_SERVICE_URL = url;
      expect(getGatewayServiceUrl('ai')).toBe(new URL(url).origin);
      expect(getConfiguredGatewayServices().ai).toBe(new URL(url).origin);
    },
  );

  it.each([
    'not-a-url',
    'ftp://ai.test',
    'file:///etc/passwd',
    'http://user:password@ai.test',
    'http://ai.test/api',
    'http://ai.test?upstream=http://other.test',
    'http://ai.test#fragment',
    ' http://ai.test',
    'http://ai.test:99999',
  ])('disables invalid AI configuration without breaking ERP: %s', (url) => {
    process.env.AI_SERVICE_URL = url;
    expect(getGatewayServiceUrl('ai')).toBeUndefined();
    expect(getConfiguredGatewayServices()).not.toHaveProperty('ai');
    expect(() => assertGatewayRuntimeEnv()).not.toThrow();
    expect(getGatewayServiceUrl('hr')).toBe('http://hr.test:4002');
  });
});
