import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export interface RequiredPermission {
  resource: string;
  action: string;
}

export const RequirePermission = (resource: string, action: string) =>
  require('@nestjs/common').SetMetadata(REQUIRE_PERMISSION_KEY, {
    resource,
    action,
  });

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission decorator — endpoint is protected by JwtAuthGuard only
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    // ── Step 1: SUPER_ADMIN bypass (global) ─────────────────────────────────
    if (user.role === 'SUPER_ADMIN') return true;

    // ── Step 2: TENANT_ADMIN bypass (within their own tenant) ───────────────
    if (user.role === 'TENANT_ADMIN') return true;

    // ── Step 3: Resolve resource by name ────────────────────────────────────
    const resource = await this.prisma.resource.findUnique({
      where: { name: required.resource },
    });

    if (!resource) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    const tenantId = user.tenantId;
    const userId = user.id;

    // ── Step 4: Check direct user_permissions ───────────────────────────────
    // Leading filter: tenantId first, then userId, then resource+action
    const directPermission = await this.prisma.userPermission.findFirst({
      where: {
        tenantId,
        userId,
        resourceId: resource.id,
        action: required.action as any,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (directPermission) return true;

    // ── Step 5: Check permission sets ────────────────────────────────────────
    const setPermission = await this.prisma.userPermissionSet.findFirst({
      where: {
        userId,
        permissionSet: {
          tenantId,
          isActive: true,
          resources: {
            some: {
              resourceId: resource.id,
              action: required.action as any,
            },
          },
        },
      },
    });

    if (setPermission) return true;

    // ── Step 6: Deny ──────────────────────────────────────────────────────────
    throw new ForbiddenException(
      "You don't have permission to access this. Contact your administrator.",
    );
  }
}
