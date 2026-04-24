import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtPayload, RequestUser } from '@work-phelo/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const token =
      request.cookies?.access_token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

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
        permissions: payload.permissions ?? [],
      };

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
