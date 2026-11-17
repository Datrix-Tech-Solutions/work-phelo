import { parseRuntimeEnv, RuntimeConfigurationError } from './runtime-env';

const valid = {
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_POLICY_VERSION: 'foundation-v1',
};

describe('AI runtime configuration', () => {
  it('parses defaults without database or provider credentials', () => {
    expect(parseRuntimeEnv(valid)).toEqual({
      ...valid,
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
      AI_SERVICE_PORT: 4011,
      AI_REQUEST_TIMEOUT_MS: 5000,
    });
  });

  it('accepts explicit non-production flags and boundary values', () => {
    expect(
      parseRuntimeEnv({
        ...valid,
        NODE_ENV: 'development',
        AI_ENABLED: 'true',
        AI_MOCK_ENABLED: 'true',
        AI_SERVICE_PORT: '65535',
        AI_REQUEST_TIMEOUT_MS: '25000',
      }),
    ).toMatchObject({
      AI_ENABLED: true,
      AI_MOCK_ENABLED: true,
      AI_SERVICE_PORT: 65535,
      AI_REQUEST_TIMEOUT_MS: 25000,
    });
    expect(
      parseRuntimeEnv({ ...valid, AI_SERVICE_PORT: '1', AI_REQUEST_TIMEOUT_MS: '1' }),
    ).toMatchObject({ AI_SERVICE_PORT: 1, AI_REQUEST_TIMEOUT_MS: 1 });
    expect(
      parseRuntimeEnv({ ...valid, AI_ENABLED: 'false', AI_MOCK_ENABLED: 'false' }).AI_ENABLED,
    ).toBe(false);
  });

  it.each(['NODE_ENV', 'AI_PROVIDER', 'AI_POLICY_VERSION'])('requires %s', (name) => {
    expect(() => parseRuntimeEnv({ ...valid, [name]: undefined })).toThrow(
      new RuntimeConfigurationError(name),
    );
  });

  it.each(['AI_ENABLED', 'AI_MOCK_ENABLED'])('strictly parses %s', (name) => {
    for (const value of ['', 'TRUE', 'False', '1', '0', 'yes', ' false ', true, null]) {
      expect(() => parseRuntimeEnv({ ...valid, [name]: value })).toThrow(
        new RuntimeConfigurationError(name),
      );
    }
  });

  it.each(['AI_SERVICE_PORT', 'AI_REQUEST_TIMEOUT_MS'])('rejects malformed %s', (name) => {
    for (const value of [
      '',
      '0',
      '-1',
      '1.5',
      '1e3',
      ' 10',
      '10\n',
      '01',
      '9007199254740992',
      10,
      null,
    ]) {
      expect(() => parseRuntimeEnv({ ...valid, [name]: value })).toThrow(
        new RuntimeConfigurationError(name),
      );
    }
  });

  it('rejects out-of-range integers', () => {
    expect(() => parseRuntimeEnv({ ...valid, AI_SERVICE_PORT: '65536' })).toThrow(
      'AI_SERVICE_PORT',
    );
    expect(() => parseRuntimeEnv({ ...valid, AI_REQUEST_TIMEOUT_MS: '25001' })).toThrow(
      'AI_REQUEST_TIMEOUT_MS',
    );
  });

  it.each(['', 'staging', 'TEST', ' test '])('rejects invalid environment %j', (NODE_ENV) => {
    expect(() => parseRuntimeEnv({ ...valid, NODE_ENV })).toThrow('NODE_ENV');
  });

  it.each(['openai', 'anthropic', 'bedrock', '', 'MOCK', ' mock '])(
    'rejects provider %j without fallback',
    (AI_PROVIDER) => {
      expect(() => parseRuntimeEnv({ ...valid, AI_PROVIDER })).toThrow('AI_PROVIDER');
    },
  );

  it.each(['', ' ', 'version with spaces', 'v1\n', 'x'.repeat(81)])(
    'rejects invalid policy identifiers',
    (AI_POLICY_VERSION) => {
      expect(() => parseRuntimeEnv({ ...valid, AI_POLICY_VERSION })).toThrow('AI_POLICY_VERSION');
    },
  );

  it.each(['AI_ENABLED', 'AI_MOCK_ENABLED'])(
    'prohibits production enablement through %s independently',
    (name) => {
      expect(() => parseRuntimeEnv({ ...valid, NODE_ENV: 'production', [name]: 'true' })).toThrow(
        'AI_ENABLED/AI_MOCK_ENABLED',
      );
    },
  );

  it('allows a production foundation only with execution disabled', () => {
    expect(parseRuntimeEnv({ ...valid, NODE_ENV: 'production' })).toMatchObject({
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
    });
  });

  it('does not include supplied values or unrelated credentials in errors', () => {
    expect(() =>
      parseRuntimeEnv({
        ...valid,
        AI_PROVIDER: 'secret-provider-value',
        JWT_SECRET: 'secret-token',
      }),
    ).toThrow('Invalid or missing AI runtime configuration: AI_PROVIDER');
  });
});
