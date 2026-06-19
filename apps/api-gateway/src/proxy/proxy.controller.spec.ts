import { createHmac } from 'crypto';
import { ProxyController } from './proxy.controller';

describe('ProxyController Reinsurance foundation', () => {
  const enableSwagger = process.env.ENABLE_SWAGGER;
  const deployEnv = process.env.DEPLOY_ENV;
  const nodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = 'gateway-phase-one-secret';
    process.env.REINSURANCE_SERVICE_URL = 'http://reinsurance-service:4007';
    process.env.DEPLOY_ENV = 'dev';
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
    if (deployEnv === undefined) {
      delete process.env.DEPLOY_ENV;
    } else {
      process.env.DEPLOY_ENV = deployEnv;
    }
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
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

  it('makes dev Swagger docs public for deployed services', () => {
    const controller = new ProxyController() as unknown as {
      isPublicPath(path: string): boolean;
    };

    for (const path of [
      '/api/v1/auth/docs',
      '/api/v1/hr/docs',
      '/api/v1/notification/docs',
      '/api/v1/subscription/docs',
      '/api/v1/marketing/docs',
      '/api/v1/operations/reinsurance/docs',
      '/api/v1/operations/reinsurance/docs/swagger-ui-init.js',
      '/api/v1/operations/reinsurance/docs-json',
    ]) {
      expect(controller.isPublicPath(path)).toBe(true);
    }

    delete process.env.ENABLE_SWAGGER;
    process.env.DEPLOY_ENV = 'prod';

    expect(controller.isPublicPath('/api/v1/operations/reinsurance/docs')).toBe(
      false,
    );
  });

  it('streams multipart write requests instead of JSON serializing them', () => {
    const controller = new ProxyController() as unknown as {
      shouldStreamRequestBody(req: {
        method: string;
        headers: Record<string, string>;
      }): boolean;
    };

    expect(
      controller.shouldStreamRequestBody({
        method: 'POST',
        headers: {
          'content-type': 'multipart/form-data; boundary=----workphelo',
        },
      }),
    ).toBe(true);
  });

  it('keeps JSON write requests on the existing JSON proxy path', () => {
    const controller = new ProxyController() as unknown as {
      shouldStreamRequestBody(req: {
        method: string;
        headers: Record<string, string>;
      }): boolean;
    };

    expect(
      controller.shouldStreamRequestBody({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      }),
    ).toBe(false);
  });
});
