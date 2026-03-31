import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import * as jwt from 'jsonwebtoken';

const SERVICES: Record<string, string> = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  hr: process.env.HR_SERVICE_URL || 'http://localhost:4002',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
  subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4005',
  marketing: process.env.MARKETING_SERVICE_URL || 'http://localhost:4006',
};

const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/auth\/login$/,
  /^\/api\/v1\/auth\/auth\/admin\/login$/,
  /^\/api\/v1\/auth\/auth\/refresh$/,
  /^\/api\/v1\/auth\/auth\/verify-email$/,
  /^\/api\/v1\/auth\/auth\/resend-verification$/,
  /^\/api\/v1\/auth\/auth\/forgot-password$/,
  /^\/api\/v1\/auth\/auth\/reset-password$/,
  /^\/api\/v1\/auth\/auth\/force-reset-password$/,
  /^\/api\/v1\/auth\/auth\/google/,
  /^\/api\/v1\/auth\/auth\/microsoft/,
  /^\/api\/v1\/auth\/tenants\/register$/,
  /^\/api\/v1\/auth\/users\/accept-invite$/,
  /^\/api\/v1\/auth\/auth\/mfa\/send-sms$/,
];

@Controller()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  @All('api/v1/*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // pathParts: ['api', 'v1', 'auth', 'login', ...]
    const pathParts = req.path.split('/').filter(Boolean);
    const service = pathParts[2]; // index 2 — after 'api' and 'v1'
    const serviceUrl = SERVICES[service];

    if (!serviceUrl) {
      return res.status(404).json({
        message: `Service '${service}' not found`,
        statusCode: 404,
      });
    }

    const isPublic = PUBLIC_PATTERNS.some((p) => p.test(req.path));

    if (!isPublic) {
      const token =
        req.cookies?.access_token ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res
          .status(401)
          .json({ message: 'No token provided', statusCode: 401 });
      }

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-user-email'] = payload.email;
        req.headers['x-user-role'] = payload.role;
        req.headers['x-tenant-id'] = payload.tenantId;
        req.headers['x-tenant-slug'] = payload.tenantSlug;
        if (payload.companyRoleId) {
          req.headers['x-company-role-id'] = payload.companyRoleId;
        }
      } catch {
        return res
          .status(401)
          .json({ message: 'Invalid or expired token', statusCode: 401 });
      }
    }

    // Strip 'api', 'v1', and service name — forward the rest downstream
    // /api/v1/auth/auth/login     → /auth/login    (auth-service)
    // /api/v1/auth/company-roles  → /company-roles (auth-service)
    // /api/v1/hr/departments      → /departments   (hr-service)
    const remainingParts = pathParts.slice(3); // remove 'api', 'v1', service
    const downstreamPath = '/' + remainingParts.join('/');

    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const targetPath = downstreamPath + queryString;

    this.logger.log(`${req.method} ${req.path} → ${serviceUrl}${targetPath}`);

    const url = new URL(serviceUrl);
    const isHttps = url.protocol === 'https:';
    const port = url.port ? parseInt(url.port) : isHttps ? 443 : 80;

    const forwardHeaders: any = {
      ...req.headers,
      host: url.hostname,
      'content-type': req.headers['content-type'] || 'application/json',
    };

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

    const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        if (value !== undefined) {
          res.setHeader(key, value as string | string[]);
        }
      });
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      this.logger.error(
        `Proxy error → ${serviceUrl}${targetPath}: ${err.message}`,
      );
      if (!res.headersSent) {
        res.status(503).json({
          message: 'Service temporarily unavailable',
          statusCode: 503,
        });
      }
    });

    if (['POST', 'PUT', 'PATCH'].includes(req.method!) && req.body) {
      const body = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
      proxyReq.write(body);
    }

    proxyReq.end();
  }
}
