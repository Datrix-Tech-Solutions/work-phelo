import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('Gateway optional AI health independence', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    for (const name of [
      'AUTH_SERVICE_URL',
      'HR_SERVICE_URL',
      'NOTIFICATION_SERVICE_URL',
      'SUBSCRIPTION_SERVICE_URL',
      'MARKETING_SERVICE_URL',
      'REINSURANCE_SERVICE_URL',
      'ACCOUNTING_SERVICE_URL',
      'INVENTORY_SERVICE_URL',
      'AI_SERVICE_URL',
    ])
      delete process.env[name];
    process.env.AUTH_SERVICE_URL = 'http://auth.test:4001';
    process.env.HR_SERVICE_URL = 'http://hr.test:4002';
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification.test:4004';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...previousEnv };
  });

  it.each(['missing', 'invalid', 'unreachable', 'unhealthy'])(
    'keeps Gateway healthy when AI is %s',
    async (state) => {
      if (state !== 'missing') {
        process.env.AI_SERVICE_URL =
          state === 'invalid' ? 'not-a-url' : 'http://ai.test:4011';
      }
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url) => {
          if (typeof url === 'string' && url.includes('ai.test')) {
            if (state === 'unreachable')
              return Promise.reject(new Error('unavailable'));
            return Promise.resolve(new Response(null, { status: 503 }));
          }
          return Promise.resolve(new Response(null, { status: 200 }));
        });
      const response = await new HealthController().check();
      expect(response.status).toBe('ok');
      if (state === 'unreachable' || state === 'unhealthy') {
        expect(response.services).toContainEqual(
          expect.objectContaining({
            service: 'ai',
            required: false,
            status: 'error',
          }),
        );
        expect(fetchMock).toHaveBeenCalledWith(
          'http://ai.test:4011/api/health',
          expect.any(Object),
        );
      } else {
        expect(response.services).not.toContainEqual(
          expect.objectContaining({ service: 'ai' }),
        );
      }
    },
  );

  it('still fails health when a required ERP dependency fails', async () => {
    process.env.AI_SERVICE_URL = 'http://ai.test:4011';
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(new HealthController().check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
