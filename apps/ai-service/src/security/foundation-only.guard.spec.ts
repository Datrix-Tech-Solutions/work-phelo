import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { HealthController } from '../health/health.controller';
import { FoundationOnlyGuard } from './foundation-only.guard';

class OtherController {
  health() {
    return {};
  }
}
const healthHandler = Object.getOwnPropertyDescriptor(HealthController.prototype, 'health')
  ?.value as unknown;
const readyHandler = Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready')
  ?.value as unknown;

describe('Foundation-only route registry', () => {
  const guard = new FoundationOnlyGuard();
  function context(
    controller: unknown,
    handler: unknown,
    path = '/api/health',
    method = 'GET',
  ): ExecutionContext {
    return {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          method,
          headers: { 'x-user-role': 'SUPER_ADMIN', 'x-gateway-auth-context': 'forged' },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('exempts only the exact two registered handlers', () => {
    expect(guard.canActivate(context(HealthController, healthHandler))).toBe(true);
    expect(guard.canActivate(context(HealthController, readyHandler, '/api/ready'))).toBe(true);
  });
  it('denies matching paths on another controller, even when borrowing a probe handler', () => {
    expect(() => guard.canActivate(context(OtherController, healthHandler))).toThrow('Forbidden');
  });
  it('denies undeclared methods on the probe controller', () => {
    expect(() => guard.canActivate(context(HealthController, () => ({})))).toThrow('Forbidden');
  });
  it.each(['/api/ready', '/health', '/api/health/', '/api/health/private'])(
    'does not exempt mismatched path %s',
    (path) => {
      expect(() => guard.canActivate(context(HealthController, healthHandler, path))).toThrow(
        'Forbidden',
      );
    },
  );
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
    'does not exempt verb %s',
    (method) => {
      expect(() =>
        guard.canActivate(context(HealthController, healthHandler, '/api/health', method)),
      ).toThrow('Forbidden');
    },
  );
});
