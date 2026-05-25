import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the reinsurance service liveness result', () => {
    const controller = new HealthController();

    expect(controller.check()).toMatchObject({
      status: 'ok',
      service: 'reinsurance-service',
    });
  });
});
