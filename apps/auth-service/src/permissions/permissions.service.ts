import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { Permission } from '@work-phelo/config';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async grantOrRevoke(
    grantedBy: string,
    tenantId: string,
    dto: GrantPermissionDto,
  ) {
    const validPermissions = Object.values(Permission) as string[];
    if (!validPermissions.includes(dto.permission)) {
      throw new BadRequestException(`Invalid permission: ${dto.permission}`);
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!targetUser)
      throw new NotFoundException('User not found in your tenant');

    if (['SUPER_ADMIN', 'TENANT_ADMIN'].includes(targetUser.role)) {
      throw new ForbiddenException('Cannot modify permissions for this role');
    }

    const result = await this.prisma.userPermission.upsert({
      where: {
        userId_permission: { userId: dto.userId, permission: dto.permission },
      },
      update: { effect: dto.effect, grantedBy, reason: dto.reason },
      create: {
        userId: dto.userId,
        tenantId,
        permission: dto.permission,
        effect: dto.effect,
        grantedBy,
        reason: dto.reason,
      },
    });

    return {
      message: `Permission ${dto.effect === 'GRANT' ? 'granted' : 'revoked'} successfully`,
      permission: result,
    };
  }

  async getUserPermissions(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        companyRole: {
          include: { permissions: { select: { permission: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Permissions from company role (DB)
    const rolePermissions = user.companyRole
      ? user.companyRole.permissions.map((p) => p.permission)
      : [];

    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
    });

    const grants = overrides
      .filter((o) => o.effect === 'GRANT')
      .map((o) => o.permission);
    const revokes = overrides
      .filter((o) => o.effect === 'REVOKE')
      .map((o) => o.permission);

    const effective = [...new Set([...rolePermissions, ...grants])].filter(
      (p) => !revokes.includes(p),
    );

    return {
      userId,
      systemRole: user.role,
      companyRole: user.companyRole?.name || null,
      rolePermissions,
      personalGrants: grants,
      personalRevokes: revokes,
      effectivePermissions: effective,
    };
  }

  async removeOverride(tenantId: string, userId: string, permission: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.userPermission.deleteMany({
      where: { userId, permission },
    });
    return {
      message:
        'Permission override removed. User reverts to company role defaults.',
    };
  }

  getAllPermissions() {
    return { permissions: Object.values(Permission) };
  }
}
