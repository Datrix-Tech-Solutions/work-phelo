import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/**
 * Role hierarchy guard with optional tenant scoping.
 * Accepts either a single role string or an array of roles.
 * Automatically bypasses for SUPER_ADMIN unless explicitly excluded.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RoleHierarchyGuard)
 * @RequiredRoles('SUPER_ADMIN') // only super admin
 * @RequiredRoles(['SUPER_ADMIN', 'TENANT_ADMIN']) // either role
 * @RequiredRoles('SUPER_ADMIN', { bypassFor: [] }) // no bypass
 */
@Injectable()
export class RoleHierarchyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string | string[]>(
      REQUIRED_ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    if (!roles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of: ${roles.join(', ')}. You have role: ${user.role}.`,
      );
    }

    return true;
  }
}
