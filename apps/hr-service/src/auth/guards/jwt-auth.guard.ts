import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
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

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Permissions are resolved by the API gateway (injected as a header)
      // rather than read from the JWT, which no longer embeds them.
      const rawPerms = request.headers['x-user-permissions'];
      let permissions: string[] = [];
      if (rawPerms) {
        try {
          const permsStr = Array.isArray(rawPerms) ? rawPerms[0] : rawPerms;
          const parsed: unknown = JSON.parse(permsStr);
          if (Array.isArray(parsed)) permissions = parsed as string[];
        } catch {
          /* fall through with empty */
        }
      } else {
        permissions = payload.permissions ?? [];
      }

      const user: RequestUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        tenantName: payload.tenantName ?? '',
        firstName: payload.firstName ?? '',
        moduleConfig: payload.moduleConfig ?? {},
        featureConfig: payload.featureConfig ?? {},
        permissions,
      };

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
