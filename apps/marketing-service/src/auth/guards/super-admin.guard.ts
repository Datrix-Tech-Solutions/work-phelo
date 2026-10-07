import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';

/** Platform-only routes: the caller must be a platform administrator, whatever tenant they sit in. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();

    if (request.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only platform administrators can do this.');
    }
    return true;
  }
}
