import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }

    // SUPER_ADMIN and TENANT_ADMIN bypass all permission checks
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    for (const permission of required) {
      const allowed = await this.hasPermission(
        user.id,
        user.companyRoleId,
        permission,
      );
      if (!allowed) {
        throw new ForbiddenException(
          "You don't have permission to access this. Contact your administrator.",
        );
      }
    }

    return true;
  }

  private async hasPermission(
    userId: string,
    companyRoleId: string | undefined,
    permission: string,
  ): Promise<boolean> {
    // 1. Check personal REVOKE — overrides everything
    const override = await this.prisma.userPermission.findUnique({
      where: { userId_permission: { userId, permission } },
    });
    if (override?.effect === 'REVOKE') return false;

    // 2. Check company role permissions from DB
    if (companyRoleId) {
      const rolePermission = await this.prisma.companyRolePermission.findUnique(
        {
          where: { companyRoleId_permission: { companyRoleId, permission } },
        },
      );
      if (rolePermission) return true;
    }

    // 3. Check personal GRANT
    if (override?.effect === 'GRANT') return true;

    return false;
  }
}
