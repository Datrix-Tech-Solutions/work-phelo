import {
  Controller,
  All,
  Req,
  Res,
  Logger,
  HttpException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import * as jwt from 'jsonwebtoken';
import { createHash, createHmac } from 'crypto';
import { isSwaggerEnabled } from '@work-phelo/config';
import { JwtPayload, RequestUser } from '@work-phelo/types';
import {
  GatewayServiceName,
  gatewayServiceConfig,
  getConfiguredGatewayServices,
  getGatewayServiceUrl,
} from '../config/runtime-env';
import { isAllowedForCareersToken } from './careers-scope';

const AUTH_LOOKUP_TIMEOUT_MS = 5_000;

const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/admin\/login$/,
  /^\/api\/v1\/auth\/refresh$/,
  /^\/api\/v1\/auth\/verify-email$/,
  /^\/api\/v1\/auth\/resend-verification$/,
  /^\/api\/v1\/auth\/forgot-password$/,
  /^\/api\/v1\/auth\/reset-password$/,
  /^\/api\/v1\/auth\/force-reset-password$/,
  /^\/api\/v1\/auth\/google(?:\/callback)?$/,
  /^\/api\/v1\/auth\/microsoft(?:\/callback)?$/,
  /^\/api\/v1\/auth\/tenants\/register$/,
  /^\/api\/v1\/auth\/recruiters\/(?:register|confirm-email|resend-confirmation|login)$/,
  /^\/api\/v1\/auth\/tenants\/slug\/[^/]+\/branding$/,
  /^\/api\/v1\/auth\/users\/accept-invite$/,
  /^\/api\/v1\/auth\/mfa\/send-sms$/,
  /^\/api\/v1\/hr\/recruitment\/public\/board$/,
  /^\/api\/v1\/hr\/recruitment\/public\/vacancies$/,
  /^\/api\/v1\/hr\/recruitment\/public\/vacancies\/[^/]+$/,
  /^\/api\/v1\/hr\/recruitment\/public\/vacancies\/[^/]+\/applications$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/basic-info$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/professional-info$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/questions$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/review$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/submit$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/documents$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/documents\/upload$/,
  /^\/api\/v1\/hr\/recruitment\/public\/applications\/[^/]+\/documents\/[^/]+$/,
  /^\/api\/v1\/operations\/reinsurance\/health$/,
  /^\/api\/v1\/operations\/inventory\/health$/,
  /^\/api\/v1\/accounting\/health$/,
];

const SWAGGER_PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/hr\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/notification\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/subscription\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/marketing\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/operations\/reinsurance\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/operations\/inventory\/docs(?:\/.*|-json|-yaml)?$/,
  /^\/api\/v1\/accounting\/docs(?:\/.*|-json|-yaml)?$/,
];

const FORWARDED_AUTH_CONTEXT_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-role',
  'x-tenant-id',
  'x-tenant-slug',
  'x-tenant-name',
  'x-user-first-name',
  'x-company-role-id',
  'x-user-permissions',
  'x-gateway-permissions-signature',
  'x-gateway-auth-context',
] as const;

const DEFAULT_PROXY_TIMEOUT_MS = 30_000;
const MAX_PROXY_TIMEOUT_MS = 300_000;

@Controller()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly services = getConfiguredGatewayServices();

  private resolveDownstream(pathParts: string[]): {
    service: GatewayServiceName | undefined;
    consumedPathParts: number;
  } {
    // Operations is a public navigation namespace, while Reinsurance remains
    // the deployable downstream service boundary.
    if (pathParts[2] === 'operations' && pathParts[3] === 'reinsurance') {
      return { service: 'reinsurance', consumedPathParts: 4 };
    }
    if (pathParts[2] === 'operations' && pathParts[3] === 'inventory') {
      return { service: 'inventory', consumedPathParts: 4 };
    }

    return {
      service: pathParts[2] as GatewayServiceName | undefined,
      consumedPathParts: 3,
    };
  }

  private fetchCurrentState(
    authServiceUrl: string,
    token: string,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer: { deadline?: NodeJS.Timeout } = {};
      const fail = (
        error = new ServiceUnavailableException(
          'Current authorization state is unavailable',
        ),
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer.deadline);
        reject(error);
      };
      let url: URL;
      try {
        url = new URL(authServiceUrl);
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error('Invalid Auth URL');
      } catch {
        fail();
        return;
      }
      const isHttps = url.protocol === 'https:';
      const port = url.port ? parseInt(url.port) : isHttps ? 443 : 80;

      const req = (isHttps ? https : http).request(
        {
          hostname: url.hostname,
          port,
          path: '/me',
          method: 'GET',
          headers: { Cookie: `access_token=${token}` },
        },
        (res) => {
          res.on('error', () => fail());
          res.on('aborted', () => fail());
          if (res.statusCode !== 200) {
            const status =
              res.statusCode === 401
                ? 401
                : res.statusCode === 403 || res.statusCode === 404
                  ? 403
                  : 503;
            fail(
              new HttpException(
                status === 503
                  ? 'Current authorization state is unavailable'
                  : 'Current session is not authorized',
                status,
              ),
            );
            res.resume();
            return;
          }
          let data = '';
          res.on('data', (chunk: Buffer | string) => {
            data += chunk.toString();
            if (Buffer.byteLength(data) > 1_048_576) {
              fail();
              req.destroy();
            }
          });
          res.on('end', () => {
            if (settled) return;
            try {
              const body: unknown = JSON.parse(data);
              settled = true;
              clearTimeout(timer.deadline);
              resolve(body);
            } catch {
              fail();
            }
          });
        },
      );
      const timeout = () => {
        fail();
        req.destroy();
      };
      timer.deadline = setTimeout(timeout, AUTH_LOOKUP_TIMEOUT_MS);
      req.setTimeout(AUTH_LOOKUP_TIMEOUT_MS, timeout);
      req.on('error', () => fail());
      req.end();
    });
  }

  private currentUser(body: unknown, payload: JwtPayload): RequestUser {
    const record = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const booleans = (value: unknown) =>
      record(value) &&
      Object.values(value).every((v) => typeof v === 'boolean');
    if (!record(body) || !record(body.user))
      throw new ServiceUnavailableException(
        'Current authorization state is unavailable',
      );
    const user = body.user;
    if (
      ![
        'id',
        'tenantId',
        'email',
        'tenantSlug',
        'tenantName',
        'firstName',
      ].every((key) => typeof user[key] === 'string') ||
      !['SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE'].includes(
        user.role as string,
      ) ||
      !booleans(user.moduleConfig) ||
      (user.integrationConfig !== undefined &&
        !booleans(user.integrationConfig)) ||
      !record(user.featureConfig) ||
      !Object.values(user.featureConfig).every(booleans) ||
      !Array.isArray(body.permissions) ||
      !body.permissions.every((p) => typeof p === 'string')
    ) {
      throw new ServiceUnavailableException(
        'Current authorization state is unavailable',
      );
    }
    if (user.id !== payload.sub || user.tenantId !== payload.tenantId)
      throw new ForbiddenException('Current session is not authorized');
    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role as string,
      email: user.email as string,
      tenantSlug: user.tenantSlug as string,
      tenantName: user.tenantName as string,
      firstName: user.firstName as string,
      moduleConfig: user.moduleConfig as Record<string, boolean>,
      integrationConfig: (user.integrationConfig ?? {}) as Record<
        string,
        boolean
      >,
      featureConfig: user.featureConfig as Record<
        string,
        Record<string, boolean>
      >,
      permissions: body.permissions,
    };
  }

  private isPublicPath(path: string): boolean {
    if (PUBLIC_PATTERNS.some((pattern) => pattern.test(path))) {
      return true;
    }

    return (
      isSwaggerEnabled() &&
      SWAGGER_PUBLIC_PATTERNS.some((pattern) => pattern.test(path))
    );
  }

  private shouldStreamRequestBody(req: Request): boolean {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return false;
    }

    const contentTypeHeader = req.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader.join(';')
      : contentTypeHeader;

    return (
      contentType?.toLowerCase().startsWith('multipart/form-data') ?? false
    );
  }

  @All('api/v1/*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // pathParts: ['api', 'v1', 'auth', 'login', ...]
    const pathParts = req.path.split('/').filter(Boolean);
    const { service, consumedPathParts } = this.resolveDownstream(pathParts);
    const serviceUrl = service ? getGatewayServiceUrl(service) : undefined;

    if (!serviceUrl) {
      const availableServices = Object.keys(this.services);

      return res.status(503).json({
        message: `Service '${service ?? 'unknown'}' is not configured for this environment`,
        availableServices,
        statusCode: 503,
      });
    }

    for (const header of FORWARDED_AUTH_CONTEXT_HEADERS) {
      delete req.headers[header];
    }

    const isPublic = this.isPublicPath(req.path);

    if (!isPublic) {
      const cookies = req.cookies as Record<string, string> | undefined;
      const token =
        cookies?.access_token ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res
          .status(401)
          .json({ message: 'No token provided', statusCode: 401 });
      }

      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET!,
        ) as JwtPayload;

        // Tokens issued to the careers site may only reach the job-posting routes.
        if (
          payload.scope === 'careers' &&
          !isAllowedForCareersToken(req.method, req.path)
        ) {
          return res.status(403).json({
            message: 'This session cannot access this resource',
            statusCode: 403,
          });
        }

        const authUrl = getGatewayServiceUrl('auth');
        if (!authUrl)
          throw new ServiceUnavailableException(
            'Current authorization state is unavailable',
          );
        let currentState: unknown;
        try {
          currentState = await this.fetchCurrentState(authUrl, token);
        } catch (error) {
          if (error instanceof HttpException) throw error;
          throw new ServiceUnavailableException(
            'Current authorization state is unavailable',
          );
        }
        const user = this.currentUser(currentState, payload);
        req.headers['x-user-id'] = user.id;
        req.headers['x-user-email'] = user.email;
        req.headers['x-user-role'] = user.role;
        req.headers['x-tenant-id'] = user.tenantId;
        req.headers['x-tenant-slug'] = user.tenantSlug;
        req.headers['x-tenant-name'] = user.tenantName;
        req.headers['x-user-first-name'] = user.firstName;
        // Preserve the permissions contract for other services; HR also requires the full current context.
        if (service !== 'auth') {
          const { permissions, ...identity } = user;
          const serializedPermissions = JSON.stringify(permissions);
          req.headers['x-user-permissions'] = serializedPermissions;
          req.headers['x-gateway-permissions-signature'] = this.signPermissions(
            payload.sub,
            payload.tenantId,
            serializedPermissions,
          );
          req.headers['x-gateway-auth-context'] = jwt.sign(
            {
              user: identity,
              permissionsHash: createHash('sha256')
                .update(serializedPermissions)
                .digest('hex'),
              tokenHash: createHash('sha256').update(token).digest('hex'),
            },
            process.env.JWT_SECRET!,
            { issuer: 'workphelo-gateway', audience: service, expiresIn: 30 },
          );
        }
      } catch (error) {
        if (error instanceof HttpException) {
          return res
            .status(error.getStatus())
            .json({ message: error.message, statusCode: error.getStatus() });
        }
        return res
          .status(401)
          .json({ message: 'Invalid or expired token', statusCode: 401 });
      }
    }

    // Strip the public route namespace before forwarding downstream:
    // /api/v1/auth/login -> /auth/login (auth-service)
    // /api/v1/hr/departments -> /departments (hr-service)
    // /api/v1/operations/reinsurance/health -> /api/health (reinsurance-service)
    const remainingParts = pathParts.slice(consumedPathParts);
    const downstreamPath = '/' + remainingParts.join('/');

    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const downstreamPrefix =
      service && gatewayServiceConfig[service]?.downstreamPrefix
        ? gatewayServiceConfig[service].downstreamPrefix
        : '';
    const targetPath = downstreamPrefix + downstreamPath + queryString;

    this.logger.log(`${req.method} ${req.path} → ${serviceUrl}${targetPath}`);

    const url = new URL(serviceUrl);
    const isHttps = url.protocol === 'https:';
    const port = url.port ? parseInt(url.port) : isHttps ? 443 : 80;

    const forwardHeaders: any = {
      ...req.headers,
      host: url.hostname,
      'content-type': req.headers['content-type'] || 'application/json',
    };

    if (
      service === 'accounting' &&
      /^\/api\/v1\/accounting\/docs(?:\/.*|-json|-yaml)?$/.test(req.path)
    ) {
      forwardHeaders['x-workphelo-gateway-docs'] = 'accounting';
      forwardHeaders['x-forwarded-host'] = req.headers.host;
      forwardHeaders['x-forwarded-proto'] = req.protocol;
    }

    if (req.headers.cookie) {
      forwardHeaders.cookie = req.headers.cookie;
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port,
      path: targetPath,
      method: req.method,
      headers: forwardHeaders,
    };

    const proxyTimeoutMs = this.proxyTimeoutMs();
    let timedOut = false;
    let clientAborted = false;

    const cleanupProxyListeners = () => {
      req.off('aborted', handleClientAbort);
      res.off('close', cleanupProxyListeners);
    };

    const handleClientAbort = () => {
      clientAborted = true;
      cleanupProxyListeners();
      proxyReq.destroy();
    };

    const proxyReq = this.createProxyRequest(isHttps, options, (proxyRes) => {
      cleanupProxyListeners();
      res.status(proxyRes.statusCode || 200);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      });
      proxyRes.pipe(res, { end: true });
    });

    req.on('aborted', handleClientAbort);
    res.on('close', cleanupProxyListeners);

    proxyReq.setTimeout(proxyTimeoutMs, () => {
      timedOut = true;
      cleanupProxyListeners();
      this.logger.warn(
        `Proxy timeout → ${serviceUrl}${targetPath} after ${proxyTimeoutMs}ms`,
      );
      proxyReq.destroy();
      if (!res.headersSent && !res.writableEnded) {
        res.status(504).json({
          message: 'Gateway timeout while contacting downstream service',
          statusCode: 504,
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    proxyReq.on('error', (err) => {
      cleanupProxyListeners();
      if (timedOut || clientAborted) {
        return;
      }

      this.logger.error(
        `Proxy error → ${serviceUrl}${targetPath}: ${err.message}`,
      );
      if (!res.headersSent && !res.writableEnded) {
        res.status(503).json({
          message: 'Service temporarily unavailable',
          statusCode: 503,
        });
      }
    });

    if (this.shouldStreamRequestBody(req)) {
      req.pipe(proxyReq);
      return;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const body = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
      proxyReq.write(body);
    }

    proxyReq.end();
  }

  private signPermissions(
    userId: string,
    tenantId: string,
    serializedPermissions: string,
  ): string {
    return createHmac('sha256', process.env.JWT_SECRET!)
      .update(`${userId}:${tenantId}:${serializedPermissions}`)
      .digest('hex');
  }

  private proxyTimeoutMs(): number {
    const configured = Number(process.env.GATEWAY_PROXY_TIMEOUT_MS);

    if (
      Number.isInteger(configured) &&
      configured > 0 &&
      configured <= MAX_PROXY_TIMEOUT_MS
    ) {
      return configured;
    }

    return DEFAULT_PROXY_TIMEOUT_MS;
  }

  private createProxyRequest(
    isHttps: boolean,
    options: http.RequestOptions,
    callback: (response: http.IncomingMessage) => void,
  ): http.ClientRequest {
    return (isHttps ? https : http).request(options, callback);
  }
}
