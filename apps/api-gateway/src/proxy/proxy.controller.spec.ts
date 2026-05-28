import { createHmac } from 'crypto';
import { ProxyController } from './proxy.controller';

describe('ProxyController Reinsurance foundation', () => {
  const enableSwagger = process.env.ENABLE_SWAGGER;

  beforeEach(() => {
    process.env.JWT_SECRET = 'gateway-phase-one-secret';
    process.env.REINSURANCE_SERVICE_URL = 'http://reinsurance-service:4007';
    process.env.ENABLE_SWAGGER = 'true';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.REINSURANCE_SERVICE_URL;
    if (enableSwagger === undefined) {
      delete process.env.ENABLE_SWAGGER;
    } else {
      process.env.ENABLE_SWAGGER = enableSwagger;
    }
  });

  it('maps the public Operations route to the Reinsurance service boundary', () => {
    const controller = new ProxyController() as unknown as {
      resolveDownstream(pathParts: string[]): {
        service: string | undefined;
        consumedPathParts: number;
      };
    };

    expect(
      controller.resolveDownstream([
        'api',
        'v1',
        'operations',
        'reinsurance',
        'access',
        'verify',
      ]),
    ).toEqual({
      service: 'reinsurance',
      consumedPathParts: 4,
    });
  });

  it('signs forwarded permissions against user and tenant context', () => {
    const controller = new ProxyController() as unknown as {
      signPermissions(
        userId: string,
        tenantId: string,
        serializedPermissions: string,
      ): string;
    };
    const permissions = JSON.stringify([
      'operations.reinsurance.dashboard:VIEW',
    ]);
    const expected = createHmac('sha256', 'gateway-phase-one-secret')
      .update(`user-1:tenant-1:${permissions}`)
      .digest('hex');

    expect(controller.signPermissions('user-1', 'tenant-1', permissions)).toBe(
      expected,
    );
  });

  it('makes Reinsurance docs public only when Swagger is explicitly enabled', () => {
    const controller = new ProxyController() as unknown as {
      isPublicPath(path: string): boolean;
    };

    expect(controller.isPublicPath('/api/v1/operations/reinsurance/docs')).toBe(
      true,
    );
    expect(
      controller.isPublicPath(
        '/api/v1/operations/reinsurance/docs/swagger-ui-init.js',
      ),
    ).toBe(true);
    expect(
      controller.isPublicPath('/api/v1/operations/reinsurance/docs-json'),
    ).toBe(true);

    delete process.env.ENABLE_SWAGGER;

    expect(controller.isPublicPath('/api/v1/operations/reinsurance/docs')).toBe(
      false,
    );
  });
});
