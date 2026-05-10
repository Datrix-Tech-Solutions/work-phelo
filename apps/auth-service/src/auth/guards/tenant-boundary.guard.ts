import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedRequest } from './permissions.types';

/**
 * Validates that the user is operating within their own tenant boundary.
 * Extracts tenantId from route params and compares against user.tenantId.
 * SUPER_ADMIN is exempt from this check.
 *
 * Usage: @UseGuards(JwtAuthGuard, TenantBoundaryGuard)
 */
@Injectable()
export class TenantBoundaryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN is exempt — they can access any tenant
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Extract tenant ID from route params
    const paramTenantId = request.params.tenantId;

    // If the route has a tenantId param, validate it matches the user's tenant
    if (paramTenantId && paramTenantId !== user.tenantId) {
      throw new ForbiddenException(
        'You do not have permission to access this tenant. You can only access your own company.',
      );
    }

    return true;
  }
}
