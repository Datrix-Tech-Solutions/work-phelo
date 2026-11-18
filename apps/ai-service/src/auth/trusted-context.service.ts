import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Request } from 'express';
import { JwtPayload, verify } from 'jsonwebtoken';

export interface TrustedAiIdentity {
  id: string;
  tenantId: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE';
  email: string;
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  moduleConfig: Record<string, boolean>;
  featureConfig: Record<string, Record<string, boolean>>;
  integrationConfig: Record<string, boolean>;
  permissions: string[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const booleans = (value: unknown): value is Record<string, boolean> =>
  record(value) && Object.values(value).every((v) => typeof v === 'boolean');
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class TrustedContextService {
  constructor(private readonly config: ConfigService) {}

  // Verification only. Current account/session validity is checked by Gateway/Auth.
  verifyRequest(request: Request): TrustedAiIdentity {
    const secret = this.config.get<unknown>('JWT_SECRET');
    if (
      this.config.get<unknown>('AI_AUTHENTICATED_ROUTES_ENABLED') !== true ||
      !nonempty(secret) ||
      secret !== secret.trim()
    )
      throw new ServiceUnavailableException();

    try {
      const cookies: unknown = request.cookies;
      const cookie = record(cookies) ? cookies.access_token : undefined;
      const authorization = request.headers.authorization;
      const token =
        cookie !== undefined
          ? cookie
          : typeof authorization === 'string' && /^Bearer \S+$/i.test(authorization)
            ? authorization.slice(7)
            : undefined;
      const signed = request.headers['x-gateway-auth-context'];
      const rawPermissions = request.headers['x-user-permissions'];
      if (!nonempty(token) || !nonempty(signed) || typeof rawPermissions !== 'string')
        throw new Error();
      const session = verify(token, secret, { algorithms: ['HS256'] });
      const assertion = verify(signed, secret, {
        algorithms: ['HS256'],
        issuer: 'workphelo-gateway',
        audience: 'ai',
        maxAge: '30s',
      });
      const now = Date.now() / 1000;
      const timed = (claims: string | JwtPayload): claims is JwtPayload =>
        record(claims) &&
        Number.isInteger(claims.iat) &&
        Number.isInteger(claims.exp) &&
        (claims.iat as number) >= 0 &&
        (claims.iat as number) <= now + 5 &&
        (claims.exp as number) > (claims.iat as number);
      if (!timed(session) || !timed(assertion)) throw new Error();
      // Auth access tokens have no issuer/audience/type/scope; reject restricted/non-user tokens.
      if (
        !nonempty(session.sub) ||
        !nonempty(session.tenantId) ||
        session.scope !== undefined ||
        session.type !== undefined ||
        session.iss !== undefined ||
        session.aud !== undefined ||
        assertion.scope !== undefined ||
        assertion.type !== undefined ||
        assertion.exp! - assertion.iat! > 30
      )
        throw new Error();

      const user: unknown = assertion.user;
      const permissions: unknown = JSON.parse(rawPermissions);
      if (
        !record(user) ||
        user.id !== session.sub ||
        user.tenantId !== session.tenantId ||
        user.scope !== undefined ||
        user.type !== undefined ||
        !['SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE'].includes(user.role as string) ||
        !['email', 'tenantSlug', 'tenantName', 'firstName'].every(
          (key) => typeof user[key] === 'string',
        ) ||
        !booleans(user.moduleConfig) ||
        !record(user.featureConfig) ||
        !Object.values(user.featureConfig).every(booleans) ||
        (user.integrationConfig !== undefined && !booleans(user.integrationConfig)) ||
        !Array.isArray(permissions) ||
        !permissions.every(nonempty) ||
        assertion.permissionsHash !== hash(rawPermissions) ||
        assertion.tokenHash !== hash(token)
      )
        throw new Error();

      return {
        id: session.sub,
        tenantId: session.tenantId,
        role: user.role as TrustedAiIdentity['role'],
        email: user.email as string,
        tenantSlug: user.tenantSlug as string,
        tenantName: user.tenantName as string,
        firstName: user.firstName as string,
        moduleConfig: user.moduleConfig,
        featureConfig: user.featureConfig as TrustedAiIdentity['featureConfig'],
        integrationConfig: user.integrationConfig ?? {},
        permissions,
      };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
