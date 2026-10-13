import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { INTERNAL_SERVICE_AUTH_HEADERS } from './constants';
import {
  AuthenticatedInternalRequest,
  InternalServiceAuthGuard,
} from './internal-service-auth.guard';
import { buildAuthHeaders } from './signing';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';
const PATH = '/internal/source-events';

function context(headers: Record<string, string>, path = PATH): ExecutionContext {
  const request = {
    headers,
    method: 'POST',
    originalUrl: path,
  } as unknown as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function signedHeaders(
  serviceName = 'reinsurance-service',
  timestamp = Math.floor(Date.now() / 1000).toString(),
  path = PATH,
): Record<string, string> {
  const signature = createHmac('sha256', SECRET)
    .update(`${serviceName}:${timestamp}:POST:${path}`)
    .digest('hex');
  return {
    [INTERNAL_SERVICE_AUTH_HEADERS.service]: serviceName,
    [INTERNAL_SERVICE_AUTH_HEADERS.timestamp]: timestamp,
    [INTERNAL_SERVICE_AUTH_HEADERS.signature]: signature,
  };
}

describe('InternalServiceAuthGuard', () => {
  const originalSecret = process.env.INTERNAL_SERVICE_AUTH_SECRET;
  const originalAllowed = process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES;
  const originalMaxClockSkew = process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_AUTH_SECRET = SECRET;
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES =
      'reinsurance-service,hr-service,payroll-service,subscription-service';
    process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS = '300';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_SECRET = originalSecret;
    }
    if (originalAllowed === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = originalAllowed;
    }
    if (originalMaxClockSkew === undefined) {
      delete process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS;
    } else {
      process.env.INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS = originalMaxClockSkew;
    }
  });

  it('requires all service authentication headers', () => {
    expect(() => new InternalServiceAuthGuard().canActivate(context({}))).toThrow(
      UnauthorizedException,
    );
  });

  it.each(['reinsurance-service', 'hr-service', 'payroll-service', 'subscription-service'])(
    'accepts a valid signature from configured service %s',
    (serviceName) => {
      expect(new InternalServiceAuthGuard().canActivate(context(signedHeaders(serviceName)))).toBe(
        true,
      );
    },
  );

  it('accepts a valid signature for the internal subledger ensure path', () => {
    const path = '/internal/subledgers/ensure';
    expect(
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('reinsurance-service', undefined, path), path),
      ),
    ).toBe(true);
  });

  it('rejects a service outside the configured allow list', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate(context(signedHeaders('unknown-service'))),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a stale signature', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000 - 301).toString();
    expect(() =>
      new InternalServiceAuthGuard().canActivate(
        context(signedHeaders('hr-service', staleTimestamp)),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a signature for a different path', () => {
    const headers = signedHeaders();
    const timestamp = headers[INTERNAL_SERVICE_AUTH_HEADERS.timestamp];
    headers[INTERNAL_SERVICE_AUTH_HEADERS.signature] = createHmac('sha256', SECRET)
      .update(`reinsurance-service:${timestamp}:POST:/internal/other`)
      .digest('hex');

    expect(() => new InternalServiceAuthGuard().canActivate(context(headers))).toThrow(
      UnauthorizedException,
    );
  });

  describe('request signature', () => {
    const signedRequest = (
      overrides: {
        method?: string;
        url?: string;
        body?: unknown;
        actingUserId?: string;
      } = {},
    ) => {
      const method = overrides.method ?? 'POST';
      const url = overrides.url ?? '/internal/source-transactions?tenantId=t1';
      const [path, queryString = ''] = url.split('?');
      const headers = buildAuthHeaders({
        secret: SECRET,
        serviceName: 'hr-service',
        method,
        path,
        signRequest: {
          query: new URLSearchParams(queryString).entries(),
          body: overrides.body ?? { amount: 20000 },
          actingUserId: overrides.actingUserId ?? 'user-1',
        },
      });
      return { headers, method, url, body: overrides.body ?? { amount: 20000 } };
    };

    const contextFor = (request: Record<string, unknown>) =>
      ({
        switchToHttp: () => ({ getRequest: () => request }),
      }) as unknown as ExecutionContext;

    it('accepts a request signature and exposes the acting user', () => {
      const { headers, method, url, body } = signedRequest();
      const request = { headers, method, originalUrl: url, body };

      expect(new InternalServiceAuthGuard().canActivate(contextFor(request))).toBe(true);
      expect((request as unknown as AuthenticatedInternalRequest).internalActingUserId).toBe(
        'user-1',
      );
    });

    it('rejects a replay with a different tenant', () => {
      const { headers, method, body } = signedRequest();
      const request = {
        headers,
        method,
        originalUrl: '/internal/source-transactions?tenantId=t2',
        body,
      };

      expect(() => new InternalServiceAuthGuard().canActivate(contextFor(request))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a tampered body', () => {
      const { headers, method, url } = signedRequest();
      const request = { headers, method, originalUrl: url, body: { amount: 1 } };

      expect(() => new InternalServiceAuthGuard().canActivate(contextFor(request))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a swapped acting user', () => {
      const { headers, method, url, body } = signedRequest();
      headers[INTERNAL_SERVICE_AUTH_HEADERS.actingUser] = 'someone-else';
      const request = { headers, method, originalUrl: url, body };

      expect(() => new InternalServiceAuthGuard().canActivate(contextFor(request))).toThrow(
        UnauthorizedException,
      );
    });

    it('does not trust an acting-user header sent without a request signature', () => {
      const headers = {
        ...signedHeaders('hr-service'),
        [INTERNAL_SERVICE_AUTH_HEADERS.actingUser]: 'forged',
      };
      const request = {
        headers,
        method: 'POST',
        originalUrl: PATH,
      } as unknown as Record<string, unknown>;

      expect(new InternalServiceAuthGuard().canActivate(contextFor(request))).toBe(true);
      expect(
        (request as unknown as AuthenticatedInternalRequest).internalActingUserId,
      ).toBeUndefined();
    });

    it('still accepts legacy-only callers unless the request signature is required', () => {
      expect(new InternalServiceAuthGuard().canActivate(context(signedHeaders('hr-service')))).toBe(
        true,
      );

      process.env.INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE = 'true';
      try {
        expect(() =>
          new InternalServiceAuthGuard().canActivate(context(signedHeaders('hr-service'))),
        ).toThrow(UnauthorizedException);
        const { headers, method, url, body } = signedRequest();
        expect(
          new InternalServiceAuthGuard().canActivate(
            contextFor({ headers, method, originalUrl: url, body }),
          ),
        ).toBe(true);
      } finally {
        delete process.env.INTERNAL_SERVICE_AUTH_REQUIRE_REQUEST_SIGNATURE;
      }
    });

    it('treats the empty body a parser fills in as no body', () => {
      const headers = buildAuthHeaders({
        secret: SECRET,
        serviceName: 'hr-service',
        method: 'GET',
        path: '/internal/x',
        signRequest: { query: [], body: undefined },
      });
      const request = { headers, method: 'GET', originalUrl: '/internal/x', body: {} };

      expect(new InternalServiceAuthGuard().canActivate(contextFor(request))).toBe(true);
    });
  });
});
