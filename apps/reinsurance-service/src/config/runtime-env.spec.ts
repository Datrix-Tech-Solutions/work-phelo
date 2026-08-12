import { assertReinsuranceRuntimeEnv } from './runtime-env';

describe('assertReinsuranceRuntimeEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL =
      'postgresql://user:pass@localhost:5432/workphelo';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
    delete process.env.DEPLOY_ENV;
    delete process.env.NODE_ENV;
    delete process.env.ACCOUNTING_SERVICE_URL;
    delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    delete process.env.REINSURANCE_ACCOUNTING_INTEGRATION_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires Accounting integration config in deployment runtimes', () => {
    process.env.DEPLOY_ENV = 'dev';

    expect(() => assertReinsuranceRuntimeEnv()).toThrow(
      'ACCOUNTING_SERVICE_URL, INTERNAL_SERVICE_AUTH_SECRET',
    );
  });

  it('validates the Accounting service URL', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.ACCOUNTING_SERVICE_URL = 'not a url';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'x'.repeat(32);

    expect(() => assertReinsuranceRuntimeEnv()).toThrow(
      'ACCOUNTING_SERVICE_URL must be a valid URL',
    );
  });

  it('requires a sufficiently strong internal auth secret', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.ACCOUNTING_SERVICE_URL = 'http://accounting-service:4008';
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'short';

    expect(() => assertReinsuranceRuntimeEnv()).toThrow(
      'INTERNAL_SERVICE_AUTH_SECRET must be at least 32 characters',
    );
  });

  it('allows integration config to be omitted when explicitly disabled', () => {
    process.env.DEPLOY_ENV = 'dev';
    process.env.REINSURANCE_ACCOUNTING_INTEGRATION_ENABLED = 'false';

    expect(() => assertReinsuranceRuntimeEnv()).not.toThrow();
  });
});
