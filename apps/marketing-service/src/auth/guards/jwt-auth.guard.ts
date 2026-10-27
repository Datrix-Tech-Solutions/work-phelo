import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { JwtPayload, RequestUser } from '@work-phelo/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const cookies = request.cookies as Record<string, string> | undefined;
    const token =
      cookies?.access_token ||
      request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('No token provided');
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('Authentication unavailable');
    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      if (!payload.sub || !payload.tenantId)
        throw new UnauthorizedException(
          'Invalid gateway authorization context',
        );
      request.user = this.currentContext(request, payload, secret, token);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Invalid or expired authorization context',
      );
    }
  }

  /** User routes require a fresh Gateway assertion; non-user entry points keep their own controls. */
  private currentContext(
    request: Request,
    payload: JwtPayload,
    secret: string,
    token: string,
  ): RequestUser {
    const signed = request.headers['x-gateway-auth-context'];
    if (typeof signed !== 'string' || !signed)
      throw new UnauthorizedException(
        'Trusted gateway authorization context required',
      );
    const context = jwt.verify(signed, secret, {
      algorithms: ['HS256'],
      issuer: 'workphelo-gateway',
      audience: 'marketing',
      maxAge: '30s',
    }) as jwt.JwtPayload;
    const user = context.user as RequestUser | undefined;
    const rawPermissions = request.headers['x-user-permissions'];
    if (typeof rawPermissions !== 'string')
      throw new UnauthorizedException('Trusted gateway permissions required');
    const permissions: unknown = JSON.parse(rawPermissions);
    const record = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const booleans = (value: unknown) =>
      record(value) &&
      Object.values(value).every((v) => typeof v === 'boolean');
    if (
      !user ||
      user.id !== payload.sub ||
      user.tenantId !== payload.tenantId ||
      !['SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE'].includes(user.role) ||
      !['email', 'tenantSlug', 'tenantName', 'firstName'].every(
        (key) => typeof user[key as keyof RequestUser] === 'string',
      ) ||
      !booleans(user.moduleConfig) ||
      (user.integrationConfig !== undefined &&
        !booleans(user.integrationConfig)) ||
      !record(user.featureConfig) ||
      !Object.values(user.featureConfig).every(booleans) ||
      !Array.isArray(permissions) ||
      !permissions.every((p) => typeof p === 'string') ||
      context.permissionsHash !==
        createHash('sha256').update(rawPermissions).digest('hex') ||
      typeof context.exp !== 'number' ||
      typeof context.iat !== 'number' ||
      context.iat > Date.now() / 1000 + 5 ||
      context.tokenHash !== createHash('sha256').update(token).digest('hex')
    ) {
      throw new UnauthorizedException('Invalid gateway authorization context');
    }
    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      tenantSlug: user.tenantSlug,
      tenantName: user.tenantName,
      firstName: user.firstName,
      integrationConfig: user.integrationConfig ?? {},
      moduleConfig: user.moduleConfig,
      featureConfig: user.featureConfig,
      permissions,
    };
  }
}
