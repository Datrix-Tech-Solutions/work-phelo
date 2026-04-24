import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GrantPermissionDto,
  RevokePermissionDto,
  AssignPermissionSetDto,
  CreatePermissionSetDto,
  UpdatePermissionSetDto,
} from './dto/grant-permission.dto';
import { PermissionAction } from './dto/grant-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Resources ─────────────────────────────────────────────────────────────

  async getAllResources() {
    return this.prisma.resource.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
  }

  async getResourceByName(name: string) {
    const r = await this.prisma.resource.findUnique({ where: { name } });
    if (!r) throw new NotFoundException(`Resource '${name}' not found`);
    return r;
  }

  // ── Grant Permission ───────────────────────────────────────────────────────
  // Creates or reactivates a user_permission row. Never hard-deletes.

  async grant(grantedBy: string, tenantId: string, dto: GrantPermissionDto) {
    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!target) throw new NotFoundException('User not found in your tenant');

    if (['SUPER_ADMIN', 'TENANT_ADMIN'].includes(target.role)) {
      throw new ForbiddenException(
        'Cannot manage permissions for SUPER_ADMIN or TENANT_ADMIN — they have full access by role',
      );
    }

    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    // Upsert — if row exists (was previously revoked), reactivate it
    const existing = await this.prisma.userPermission.findUnique({
      where: {
        userId_resourceId_action: {
          userId: dto.userId,
          resourceId: dto.resourceId,
          action: dto.action as any,
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.userPermission.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          grantedBy,
          grantedAt: new Date(),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          revokedBy: null,
          revokedAt: null,
        },
        include: {
          resource: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });
      return {
        message: 'Permission granted (reactivated)',
        permission: updated,
      };
    }

    const permission = await this.prisma.userPermission.create({
      data: {
        tenantId,
        userId: dto.userId,
        resourceId: dto.resourceId,
        action: dto.action as any,
        grantedBy,
        grantedAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: true,
      },
      include: {
        resource: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    await this.audit.log({
      tenantId: tenantId,
      userId: grantedBy,
      action: 'ASSIGN',
      resource: 'permission-sets',
      resourceId: dto.userId,
      changes: { after: { resourceId: dto.resourceId, action: dto.action } },
      status: 'SUCCESS',
    });
    return { message: 'Permission granted', permission };
  }

  // ── Revoke Permission ──────────────────────────────────────────────────────
  // Soft update — sets is_active=false, records who revoked and when.
  // Row is NEVER hard-deleted.

  async revoke(revokedBy: string, tenantId: string, dto: RevokePermissionDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found in your tenant');

    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const existing = await this.prisma.userPermission.findFirst({
      where: {
        tenantId,
        userId: dto.userId,
        resourceId: dto.resourceId,
        action: dto.action as any,
      },
    });

    if (existing && !existing.isActive) {
      throw new BadRequestException('Permission is already revoked');
    }

    const updated = await this.prisma.userPermission.upsert({
      where: {
        userId_resourceId_action: {
          userId: dto.userId,
          resourceId: dto.resourceId,
          action: dto.action as any,
        },
      },
      update: {
        isActive: false,
        revokedBy,
        revokedAt: new Date(),
      },
      create: {
        tenantId,
        userId: dto.userId,
        resourceId: dto.resourceId,
        action: dto.action as any,
        grantedBy: revokedBy,
        isActive: false,
        revokedBy,
        revokedAt: new Date(),
      },
      include: { resource: true },
    });

    await this.audit.log({
      tenantId: tenantId,
      userId: revokedBy,
      action: 'REVOKE',
      resource: 'permission-sets',
      resourceId: dto.userId,
      changes: { after: { resourceId: dto.resourceId, action: dto.action } },
      status: 'SUCCESS',
    });
    return { message: 'Permission revoked', permission: updated };
  }

  // ── Permission Sets ────────────────────────────────────────────────────────

  async createPermissionSet(tenantId: string, dto: CreatePermissionSetDto) {
    const existing = await this.prisma.permissionSet.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `A permission set named "${dto.name}" already exists`,
      );
    }

    if (dto.resources.length > 0) {
      const resourceIds = dto.resources.map((r) => r.resourceId);
      const found = await this.prisma.resource.findMany({
        where: { id: { in: resourceIds } },
        select: { id: true },
      });
      if (found.length !== resourceIds.length) {
        throw new NotFoundException('One or more resources not found');
      }
    }

    return this.prisma.permissionSet.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        resources: {
          create: dto.resources.map((r) => ({
            resourceId: r.resourceId,
            action: r.action as any,
          })),
        },
      },
      include: { resources: { include: { resource: true } } },
    });
  }

  async updatePermissionSet(
    tenantId: string,
    id: string,
    dto: UpdatePermissionSetDto,
  ) {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!set) throw new NotFoundException('Permission set not found');

    if (dto.resources.length > 0) {
      const resourceIds = dto.resources.map((r) => r.resourceId);
      const found = await this.prisma.resource.findMany({
        where: { id: { in: resourceIds } },
        select: { id: true },
      });
      if (found.length !== resourceIds.length) {
        throw new NotFoundException('One or more resources not found');
      }
    }

    // Replace all resources atomically
    await this.prisma.permissionSetResource.deleteMany({
      where: { permissionSetId: id },
    });

    return this.prisma.permissionSet.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        resources: {
          create: dto.resources.map((r) => ({
            resourceId: r.resourceId,
            action: r.action as any,
          })),
        },
      },
      include: { resources: { include: { resource: true } } },
    });
  }

  // kept for internal seeding use
  async _createPermissionSetRaw(
    tenantId: string,
    name: string,
    description: string,
    resources: { resourceId: string; action: string }[],
  ) {
    if (resources.length > 0) {
      const resourceIds = resources.map((r) => r.resourceId);
      const found = await this.prisma.resource.findMany({
        where: { id: { in: resourceIds } },
        select: { id: true },
      });
      if (found.length !== resourceIds.length) {
        throw new NotFoundException('One or more resources not found');
      }
    }

    return this.prisma.permissionSet.create({
      data: {
        tenantId,
        name,
        description,
        resources: {
          create: resources.map((r) => ({
            resourceId: r.resourceId,
            action: r.action as any,
          })),
        },
      },
      include: { resources: { include: { resource: true } } },
    });
  }

  async getPermissionSets(tenantId: string) {
    return this.prisma.permissionSet.findMany({
      where: { tenantId, isActive: true },
      include: {
        resources: { include: { resource: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async assignPermissionSet(
    grantedBy: string,
    tenantId: string,
    dto: AssignPermissionSetDto,
  ) {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id: dto.permissionSetId, tenantId },
    });
    if (!set) throw new NotFoundException('Permission set not found');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.userPermissionSet.upsert({
      where: {
        userId_permissionSetId: {
          userId: dto.userId,
          permissionSetId: dto.permissionSetId,
        },
      },
      update: { grantedBy, grantedAt: new Date() },
      create: {
        userId: dto.userId,
        permissionSetId: dto.permissionSetId,
        grantedBy,
      },
    });
  }

  async removePermissionSet(
    tenantId: string,
    userId: string,
    permissionSetId: string,
  ) {
    const assignment = await this.prisma.userPermissionSet.findUnique({
      where: { userId_permissionSetId: { userId, permissionSetId } },
      include: { permissionSet: true },
    });
    if (!assignment || assignment.permissionSet.tenantId !== tenantId) {
      throw new NotFoundException('Assignment not found');
    }
    await this.prisma.userPermissionSet.delete({
      where: { userId_permissionSetId: { userId, permissionSetId } },
    });
    return { message: 'Permission set removed from user' };
  }

  // ── User Effective Permissions ─────────────────────────────────────────────

  async getUserPermissions(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Direct permissions (active and not expired)
    // Direct permissions (all records, to distinguish active vs explicitly denied)
    const allDirectPerms = await this.prisma.userPermission.findMany({
      where: {
        tenantId,
        userId,
      },
      include: { resource: true },
    });

    // Active direct permissions (must not be expired)
    const directPerms = allDirectPerms.filter(
      (p) => p.isActive && (!p.expiresAt || p.expiresAt > new Date()),
    );

    // Permission set permissions
    const setAssignments = await this.prisma.userPermissionSet.findMany({
      where: { userId },
      include: {
        permissionSet: {
          include: {
            resources: { include: { resource: true } },
          },
        },
      },
    });

    const setPerms = setAssignments.flatMap((a) =>
      a.permissionSet.resources.map((r) => ({
        resourceId: r.resourceId,
        resourceName: r.resource.name,
        module: r.resource.module,
        action: r.action,
        source: `set:${a.permissionSet.name}`,
      })),
    );

    const directFormatted = directPerms.map((p) => ({
      id: p.id,
      resourceId: p.resourceId,
      resourceName: p.resource.name,
      module: p.resource.module,
      action: p.action,
      grantedAt: p.grantedAt,
      expiresAt: p.expiresAt,
      source: 'direct',
    }));

    return {
      userId,
      systemRole: user.role,
      directPermissions: directFormatted,
      permissionSets: setAssignments.map((a) => ({
        id: a.permissionSet.id,
        name: a.permissionSet.name,
        grantedAt: a.grantedAt,
        permissions: a.permissionSet.resources.map((r) => ({
          resource: r.resource.name,
          action: r.action,
        })),
      })),
      effectivePermissions: [
        ...directFormatted.map((p) => `${p.resourceName}:${p.action}`),
        ...setPerms.map((p) => `${p.resourceName}:${p.action}`),
      ]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    };
  }

  // ── History ────────────────────────────────────────────────────────────────

  async getPermissionHistory(tenantId: string, userId: string) {
    return this.prisma.userPermission.findMany({
      where: { tenantId, userId },
      include: {
        resource: { select: { name: true, module: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
