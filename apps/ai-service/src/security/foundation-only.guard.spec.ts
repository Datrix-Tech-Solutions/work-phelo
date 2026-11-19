import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConversationAuthorizationService } from './conversation-authorization.service';
import { HealthController } from '../health/health.controller';
import { FoundationOnlyGuard } from './foundation-only.guard';
import { TrustedAuthGuard } from '../auth/trusted-auth.guard';
import { EligibilityController } from '../eligibility/eligibility.controller';

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
  const authenticate = jest.fn(() => true);
  const guard = new FoundationOnlyGuard(
    { canActivate: authenticate } as unknown as TrustedAuthGuard,
    {
      authorize: () => {
        throw new ForbiddenException();
      },
    } as unknown as ConversationAuthorizationService,
  );
  const setHeader = jest.fn();
  beforeEach(() => {
    authenticate.mockClear();
    setHeader.mockClear();
  });
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
        getResponse: () => ({ setHeader }),
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
  it('always authenticates the exact eligibility handler without relying on a decorator', () => {
    const handler = Object.getOwnPropertyDescriptor(EligibilityController.prototype, 'eligibility')
      ?.value as unknown;
    expect(guard.canActivate(context(EligibilityController, handler, '/api/eligibility'))).toBe(
      true,
    );
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(() => guard.canActivate(context(OtherController, handler, '/api/eligibility'))).toThrow(
      'Forbidden',
    );
    expect(() =>
      guard.canActivate(context(EligibilityController, handler, '/api/eligibility', 'HEAD')),
    ).toThrow('Forbidden');
    expect(authenticate).toHaveBeenCalledTimes(1);
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
