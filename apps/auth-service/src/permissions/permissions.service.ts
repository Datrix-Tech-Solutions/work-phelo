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
import {
  isResourceEnabledForTenant,
  PermissionResourceWithId,
  TenantEntitlementConfig,
} from './permission-entitlements';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Resources ─────────────────────────────────────────────────────────────

  async getAllResources(tenantId?: string, includeAll = false) {
    const resources = await this.prisma.resource.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    if (!tenantId || includeAll) return resources;

    const config = await this.getTenantEntitlementConfig(tenantId);
    return resources.filter((resource) =>
      isResourceEnabledForTenant(resource, config),
    );
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
    await this.assertResourcesGrantableForTenant(tenantId, [resource]);

    // Upsert — if row exists (was previously revoked), reactivate it
    const existing = await this.prisma.userPermission.findUnique({
      where: {
        userId_resourceId_action: {
          userId: dto.userId,
          resourceId: dto.resourceId,
          action: dto.action,
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
        action: dto.action,
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
        action: dto.action,
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
          action: dto.action,
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
        action: dto.action,
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
      const uniqueResourceIds = [
        ...new Set(dto.resources.map((r) => r.resourceId)),
      ];
      const found = await this.prisma.resource.findMany({
        where: { id: { in: uniqueResourceIds } },
      });
      if (found.length !== uniqueResourceIds.length) {
        throw new NotFoundException('One or more resources not found');
      }
      await this.assertResourcesGrantableForTenant(tenantId, found);
    }

    return this.prisma.permissionSet.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        resources: {
          create: dto.resources.map((r) => ({
            resourceId: r.resourceId,
            action: r.action,
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
      include: { resources: { include: { resource: true } } },
    });
    if (!set) throw new NotFoundException('Permission set not found');
    if (set.isSystem) {
      throw new ForbiddenException('System permission sets cannot be edited');
    }

    const resourcesToPersist = [...dto.resources];

    if (dto.resources.length > 0) {
      const uniqueResourceIds = [
        ...new Set(dto.resources.map((r) => r.resourceId)),
      ];
      const found = await this.prisma.resource.findMany({
        where: { id: { in: uniqueResourceIds } },
      });
      if (found.length !== uniqueResourceIds.length) {
        throw new NotFoundException('One or more resources not found');
      }
      await this.assertResourcesGrantableForTenant(tenantId, found, {
        existingGrantKeys: new Set(
          set.resources.map((r) => `${r.resourceId}:${r.action}`),
        ),
        requestedGrantKeys: dto.resources.map(
          (r) => `${r.resourceId}:${r.action}`,
        ),
      });
    }

    const tenantConfig = await this.getTenantEntitlementConfig(tenantId);
    const hiddenExistingResources = set.resources.filter(
      (r) => !isResourceEnabledForTenant(r.resource, tenantConfig),
    );
    const requestedKeys = new Set(
      resourcesToPersist.map((r) => `${r.resourceId}:${r.action}`),
    );
    for (const existing of hiddenExistingResources) {
      const key = `${existing.resourceId}:${existing.action}`;
      if (requestedKeys.has(key)) continue;
      requestedKeys.add(key);
      resourcesToPersist.push({
        resourceId: existing.resourceId,
        action: existing.action as PermissionAction,
      });
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
          create: resourcesToPersist.map((r) => ({
            resourceId: r.resourceId,
            action: r.action,
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
      const uniqueResourceIds = [
        ...new Set(resources.map((r) => r.resourceId)),
      ];
      const found = await this.prisma.resource.findMany({
        where: { id: { in: uniqueResourceIds } },
        select: { id: true },
      });
      if (found.length !== uniqueResourceIds.length) {
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
            action: r.action as PermissionAction,
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

  async getPermissionSetMembers(tenantId: string, permissionSetId: string) {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id: permissionSetId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!set) throw new NotFoundException('Permission set not found');

    const assignments = await this.prisma.userPermissionSet.findMany({
      where: { permissionSetId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    return assignments.map((assignment) => ({
      id: assignment.user.id,
      firstName: assignment.user.firstName,
      lastName: assignment.user.lastName,
      email: assignment.user.email,
      role: assignment.user.role,
      status: assignment.user.status,
      grantedAt: assignment.grantedAt,
    }));
  }

  async getPermissionRecipients(
    tenantId: string,
    resourceName: string,
    action: PermissionAction,
    options?: {
      includeTenantAdmins?: boolean;
      activeOnly?: boolean;
    },
  ) {
    const includeTenantAdmins = options?.includeTenantAdmins ?? false;
    const activeOnly = options?.activeOnly ?? true;
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { status: 'ACTIVE' } : {}),
        ...(includeTenantAdmins ? {} : { role: 'EMPLOYEE' }),
        OR: [
          {
            userPermissions: {
              some: {
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                action,
                resource: {
                  name: resourceName,
                  isActive: true,
                },
              },
            },
          },
          {
            permissionSets: {
              some: {
                permissionSet: {
                  isActive: true,
                  resources: {
                    some: {
                      action,
                      resource: {
                        name: resourceName,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
          ...(includeTenantAdmins ? [{ role: 'TENANT_ADMIN' as const }] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    }));
  }

  async assignPermissionSet(
    grantedBy: string,
    tenantId: string,
    dto: AssignPermissionSetDto,
  ) {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id: dto.permissionSetId, tenantId },
      include: { resources: { include: { resource: true } } },
    });
    if (!set) throw new NotFoundException('Permission set not found');
    if (set.isSystem) {
      throw new ForbiddenException(
        'System permission sets cannot be assigned through the tenant permission management flow',
      );
    }
    await this.assertResourcesGrantableForTenant(
      tenantId,
      set.resources.map((r) => r.resource),
    );

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'EMPLOYEE') {
      throw new ForbiddenException(
        'Permission sets can only be assigned to employee users',
      );
    }

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

  async deletePermissionSet(tenantId: string, id: string) {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id, tenantId },
    });
    if (!set) throw new NotFoundException('Permission set not found');
    if (set.isSystem) {
      throw new ForbiddenException('System permission sets cannot be deleted');
    }
    await this.prisma.permissionSet.delete({ where: { id } });
    return { message: 'Permission set deleted' };
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

  private async getTenantEntitlementConfig(
    tenantId: string,
  ): Promise<TenantEntitlementConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { moduleConfig: true, featureConfig: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      moduleConfig: (tenant.moduleConfig as Record<string, boolean>) ?? {},
      featureConfig:
        (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {},
    };
  }

  private async assertResourcesGrantableForTenant(
    tenantId: string,
    resources: PermissionResourceWithId[],
    options?: {
      existingGrantKeys?: Set<string>;
      requestedGrantKeys?: string[];
    },
  ) {
    const config = await this.getTenantEntitlementConfig(tenantId);
    const existingGrantKeys = options?.existingGrantKeys ?? new Set<string>();
    const requestedGrantKeys = options?.requestedGrantKeys;
    const disabled = resources.filter((resource) => {
      if (isResourceEnabledForTenant(resource, config)) return false;
      if (!requestedGrantKeys) return true;
      if (!resource.id) return true;

      return requestedGrantKeys
        .filter((key) => key.startsWith(`${resource.id}:`))
        .some((key) => !existingGrantKeys.has(key));
    });

    if (disabled.length === 0) return;

    const names = [...new Set(disabled.map((resource) => resource.name))].join(
      ', ',
    );
    throw new ForbiddenException(
      `Cannot grant permissions for disabled tenant module or feature: ${names}`,
    );
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
      where: {
        userId,
        permissionSet: { isActive: true },
      },
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
