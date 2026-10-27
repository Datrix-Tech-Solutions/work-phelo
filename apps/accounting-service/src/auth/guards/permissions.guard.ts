import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSION_EXEMPT_KEY,
  PermissionExemption,
  permissionTargets,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = permissionTargets(context.getHandler(), context.getClass());
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );
    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      targets,
    );

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException(DENY_MESSAGE);

    if (!requiredPermissions?.length && !anyPermissions?.length) {
      const exemption = this.reflector.getAllAndOverride<PermissionExemption>(
        PERMISSION_EXEMPT_KEY,
        targets,
      );
      if (
        !exemption ||
        !['self-service', 'module-reference', 'service-policy'].includes(
          exemption.policy,
        ) ||
        typeof exemption.reason !== 'string' ||
        !exemption.reason.trim()
      ) {
        throw new ForbiddenException(DENY_MESSAGE);
      }
      return true;
    }

    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;

    const permissions = new Set(user.permissions);
    if (
      requiredPermissions?.length &&
      !requiredPermissions.every((permission) => permissions.has(permission))
    ) {
      throw new ForbiddenException(DENY_MESSAGE);
    }
    if (
      anyPermissions?.length &&
      !anyPermissions.some((permission) => permissions.has(permission))
    ) {
      throw new ForbiddenException(DENY_MESSAGE);
    }
    return true;
  }
}
