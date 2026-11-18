import { ConfigService } from '@nestjs/config';
import { FoundationReadinessService } from './foundation-readiness.service';

const valid = {
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_ENABLED: false,
  AI_MOCK_ENABLED: false,
  AI_POLICY_VERSION: 'test-v1',
  AI_SERVICE_PORT: 4011,
  AI_REQUEST_TIMEOUT_MS: 5000,
};

describe('Foundation readiness', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env = {};
  });
  afterEach(() => {
    process.env = { ...original };
  });
  it('is ready with disabled inference and without external dependencies', () => {
    expect(new FoundationReadinessService(new ConfigService(valid)).isReady()).toBe(true);
  });

  it('does not imply external inference when internal mock execution is enabled', () => {
    expect(
      new FoundationReadinessService(
        new ConfigService({ ...valid, AI_ENABLED: true, AI_MOCK_ENABLED: true }),
      ).isReady(),
    ).toBe(true);
  });

  it.each([
    { AI_PROVIDER: 'external' },
    { AI_ENABLED: 'true' },
    { AI_SERVICE_PORT: 0 },
    { AI_REQUEST_TIMEOUT_MS: 30000 },
    { AI_POLICY_VERSION: '' },
    { NODE_ENV: 'production', AI_MOCK_ENABLED: true },
  ])('rejects an invalid internal state', (override) => {
    expect(
      new FoundationReadinessService(new ConfigService({ ...valid, ...override })).isReady(),
    ).toBe(false);
  });

  it('becomes unready during shutdown', () => {
    const service = new FoundationReadinessService(new ConfigService(valid));
    service.beforeApplicationShutdown();
    expect(service.isReady()).toBe(false);
  });
});
