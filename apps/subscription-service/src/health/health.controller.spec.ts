import { HealthController } from './health.controller';

describe('Subscription scaffold health', () => {
  it('reports availability with a valid timestamp, not a billing-readiness claim', () => {
    const result = new HealthController().check();
    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(Object.keys(result).sort()).toEqual(['status', 'timestamp']);
  });
});
