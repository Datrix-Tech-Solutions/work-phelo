import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLE_PERMISSIONS } from '@erp/config';
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

    if (!user)
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );

    for (const permission of required) {
      const allowed = await this.hasPermission(user.id, user.role, permission);
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
    role: string,
    permission: string,
  ): Promise<boolean> {
    const revoke = await this.prisma.userPermission.findUnique({
      where: { userId_permission: { userId, permission } },
    });

    if (revoke?.effect === 'REVOKE') return false;

    const rolePerms = ROLE_PERMISSIONS[role] || [];
    const hasRolePermission = rolePerms.includes(permission as any);
    if (hasRolePermission) return true;

    if (revoke?.effect === 'GRANT') return true;

    return false;
  }
}
