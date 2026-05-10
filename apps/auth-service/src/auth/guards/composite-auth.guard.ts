import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './permissions.types';

/**
 * Composite guard that applies role hierarchy checks.
 * Order: SUPER_ADMIN check → TENANT_ADMIN check → EMPLOYEE check
 *
 * This guard is lighter than running JwtAuthGuard + RolesGuard + PermissionsGuard
 * separately. It provides a single decision point for role-based access.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, CompositeAuthGuard)
 * @Roles('SUPER_ADMIN') // exact role match
 */
@Injectable()
export class CompositeAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const requiredRoles = this.reflector.get<string | string[]>(
      'roles',
      context.getHandler(),
    );
    const platformAdminOnly = this.reflector.get<boolean>(
      'platformAdminOnly',
      context.getHandler(),
    );
    const tenantAdminSelfOnly = this.reflector.get<boolean>(
      'tenantAdminSelfOnly',
      context.getHandler(),
    );

    // Platform admin only
    if (platformAdminOnly && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'This action requires platform administrator access.',
      );
    }

    // Tenant admin self-only: allow SUPER_ADMIN or same-tenant TENANT_ADMIN
    if (tenantAdminSelfOnly) {
      const paramTenantId = request.params.tenantId;
      if (
        user.role === 'TENANT_ADMIN' &&
        paramTenantId &&
        paramTenantId !== user.tenantId
      ) {
        throw new ForbiddenException(
          'You can only manage your own company. You do not have access to this tenant.',
        );
      }
    }

    // Role-specific check
    if (requiredRoles) {
      const roles = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];
      if (!roles.includes(user.role)) {
        throw new ForbiddenException(
          `This action requires one of: ${roles.join(', ')}. You have role: ${user.role}.`,
        );
      }
    }

    return true;
  }
}
