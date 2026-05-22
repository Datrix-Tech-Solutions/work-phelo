import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload, RequestUser } from '@work-phelo/types';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookieToken(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='))
    ?.slice('access_token='.length);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();

    const token =
      parseCookieToken(firstHeader(request.headers.cookie)) ||
      firstHeader(request.headers.authorization)?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('No token provided');
    if (!process.env.JWT_SECRET) {
      throw new UnauthorizedException('Notification auth is not configured');
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        tenantName:
          firstHeader(request.headers['x-tenant-name']) ??
          payload.tenantName ??
          '',
        firstName:
          firstHeader(request.headers['x-user-first-name']) ??
          payload.firstName ??
          '',
        moduleConfig: payload.moduleConfig ?? {},
        featureConfig: payload.featureConfig ?? {},
        permissions:
          this.parsePermissions(
            firstHeader(request.headers['x-user-permissions']),
          ) ??
          payload.permissions ??
          [],
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private parsePermissions(raw: string | undefined): string[] | undefined {
    if (!raw) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : undefined;
    } catch {
      return undefined;
    }
  }
}
