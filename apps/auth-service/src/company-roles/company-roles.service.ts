import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyRoleDto } from './dto/create-company-role.dto';
import { UpdateCompanyRoleDto } from './dto/update-company-role.dto';
import { seedSystemPermissionSets } from '../permissions/system-permission-sets';

@Injectable()
export class CompanyRolesService {
  private readonly logger = new Logger(CompanyRolesService.name);
  private static readonly SYSTEM_ROLE_SET_NAMES = [
    'Company Admin Set',
    'Manager Set',
    'Employee Set',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  private async removeOtherSystemRoleSets(
    tenantId: string,
    userId: string,
    keepSetName: (typeof CompanyRolesService.SYSTEM_ROLE_SET_NAMES)[number],
  ) {
    const setsToRemove = await this.prisma.permissionSet.findMany({
      where: {
        tenantId,
        isSystem: true,
        isActive: true,
        name: {
          in: CompanyRolesService.SYSTEM_ROLE_SET_NAMES.filter(
            (name) => name !== keepSetName,
          ),
        },
      },
      select: { id: true, name: true },
    });

    if (setsToRemove.length === 0) return;

    await this.prisma.userPermissionSet.deleteMany({
      where: {
        userId,
        permissionSetId: { in: setsToRemove.map((set) => set.id) },
      },
    });

    this.logger.log(
      `Removed competing system role set(s) from user ${userId}: ${setsToRemove
        .map((set) => set.name)
        .join(', ')}`,
    );
  }

  async seedDefaultRoles(tenantId: string) {
    const defaultRoles = ['Company Admin', 'Manager', 'Employee'];
    for (const name of defaultRoles) {
      await this.prisma.companyRole.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: { tenantId, name, isSystem: true },
      });
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.companyRole.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const role = await this.prisma.companyRole.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Company role not found');
    return role;
  }

  async create(tenantId: string, dto: CreateCompanyRoleDto) {
    const existing = await this.prisma.companyRole.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A role with this name already exists');

    const role = await this.prisma.companyRole.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: dto.permissions ?? {},
      },
    });

    // Create the matching PermissionSet so assignRoleToUser can find it.
    // Convention: a role named "Leave Manager" gets a set named "Leave Manager Set".
    if (dto.permissions && Object.keys(dto.permissions).length > 0) {
      await this.syncPermissionSet(tenantId, role.name, dto.permissions);
    }

    return role;
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyRoleDto) {
    const role = await this.findById(tenantId, id);
    if (role.isSystem) {
      throw new ForbiddenException('Default roles cannot be edited');
    }

    const updated = await this.prisma.companyRole.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions && { permissions: dto.permissions }),
      },
    });

    // Keep the PermissionSet in sync whenever permissions are updated.
    if (dto.permissions) {
      await this.syncPermissionSet(tenantId, updated.name, dto.permissions);
    }

    return updated;
  }

  // Creates or replaces the PermissionSet for a custom role, then ensures any users
  // already assigned this role also have the new set applied.
  private async syncPermissionSet(
    tenantId: string,
    roleName: string,
    permissions: Record<string, string[]>,
  ) {
    const setName = `${roleName} Set`;

    // Resolve resource IDs from the Resource table
    const resourceNames = Object.keys(permissions);
    const resources = await this.prisma.resource.findMany({
      where: { name: { in: resourceNames } },
      select: { id: true, name: true },
    });
    const resourceMap = new Map(resources.map((r) => [r.name, r.id]));

    this.logger.log(
      `syncPermissionSet "${setName}": ` +
        `requested ${resourceNames.length} resources, found ${resources.length} in DB ` +
        `(missing: ${resourceNames.filter((n) => !resourceMap.has(n)).join(', ') || 'none'})`,
    );

    // Build resource-action pairs, skipping resources not yet seeded
    const seen = new Set<string>();
    const resourceActions: { resourceId: string; action: string }[] = [];
    for (const [resourceName, actions] of Object.entries(permissions)) {
      const resourceId = resourceMap.get(resourceName);
      if (!resourceId) continue;
      for (const action of actions) {
        const key = `${resourceId}:${action}`;
        if (seen.has(key)) continue; // deduplicate
        seen.add(key);
        resourceActions.push({ resourceId, action });
      }
    }

    this.logger.log(
      `syncPermissionSet "${setName}": ${resourceActions.length} resource-action pairs`,
    );

    // Upsert the PermissionSet
    let permSet = await this.prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: setName } },
    });

    if (permSet) {
      // Replace all resources on the existing set
      await this.prisma.permissionSetResource.deleteMany({
        where: { permissionSetId: permSet.id },
      });
      await this.prisma.permissionSetResource.createMany({
        data: resourceActions.map((ra) => ({
          permissionSetId: permSet!.id,
          resourceId: ra.resourceId,
          action: ra.action as any,
        })),
        skipDuplicates: true,
      });
    } else {
      permSet = await this.prisma.permissionSet.create({
        data: {
          tenantId,
          name: setName,
          isSystem: false,
          resources: {
            create: resourceActions.map((ra) => ({
              resourceId: ra.resourceId,
              action: ra.action as any,
            })),
          },
        },
      });
    }

    // Assign the set to any users who already have this role but don't yet have the set.
    // This covers roles that were assigned before the set existed.
    const role = await this.prisma.companyRole.findUnique({
      where: { tenantId_name: { tenantId, name: roleName } },
      select: { id: true },
    });
    if (!role) return;

    const usersWithRole = await this.prisma.user.findMany({
      where: { tenantId, companyRoleId: role.id },
      select: { id: true },
    });

    for (const user of usersWithRole) {
      await this.prisma.userPermissionSet.upsert({
        where: {
          userId_permissionSetId: {
            userId: user.id,
            permissionSetId: permSet.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          permissionSetId: permSet.id,
          grantedBy: 'system',
        },
      });
    }
  }

  async remove(tenantId: string, id: string) {
    const role = await this.findById(tenantId, id);
    if (role.isSystem)
      throw new ForbiddenException('Default roles cannot be deleted');
    if (role._count.users > 0) {
      throw new ConflictException(
        'This role has employees assigned to it and cannot be deleted. Reassign employees before deleting.',
      );
    }
    return this.prisma.companyRole.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignRoleToUser(
    tenantId: string,
    assignedBy: string,
    userId: string,
    companyRoleId: string,
  ) {
    const newRole = await this.findById(tenantId, companyRoleId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');

    const setName = `${newRole.name} Set`;

    const rolePerms = newRole.permissions as Record<string, string[]> | null;
    if (
      newRole.isSystem &&
      CompanyRolesService.SYSTEM_ROLE_SET_NAMES.includes(
        setName as (typeof CompanyRolesService.SYSTEM_ROLE_SET_NAMES)[number],
      )
    ) {
      await seedSystemPermissionSets(this.prisma, tenantId, this.logger);
    } else if (rolePerms && Object.keys(rolePerms).length > 0) {
      // Custom roles keep their permission set in sync with the stored role JSON.
      this.logger.log(
        `Syncing permission set "${setName}" for role "${newRole.name}"`,
      );
      await this.syncPermissionSet(tenantId, newRole.name, rolePerms);
    }

    const permSet = await this.prisma.permissionSet.findFirst({
      where: { tenantId, name: setName },
    });

    this.logger.log(
      permSet
        ? `Found permission set "${setName}" (${permSet.id}) — assigning to user ${userId}`
        : `No permission set found for "${setName}" — role may have no permissions defined`,
    );

    if (permSet) {
      if (
        newRole.isSystem &&
        CompanyRolesService.SYSTEM_ROLE_SET_NAMES.includes(
          setName as (typeof CompanyRolesService.SYSTEM_ROLE_SET_NAMES)[number],
        )
      ) {
        await this.removeOtherSystemRoleSets(
          tenantId,
          userId,
          setName as (typeof CompanyRolesService.SYSTEM_ROLE_SET_NAMES)[number],
        );
      }

      await this.prisma.userPermissionSet.upsert({
        where: {
          userId_permissionSetId: { userId, permissionSetId: permSet.id },
        },
        update: { grantedBy: assignedBy, grantedAt: new Date() },
        create: { userId, permissionSetId: permSet.id, grantedBy: assignedBy },
      });
    }

    // ── Update companyRoleId to the latest assigned role (primary display) ───
    return this.prisma.user.update({
      where: { id: userId },
      data: { companyRoleId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyRoleId: true,
        companyRole: { select: { id: true, name: true } },
      },
    });
  }

  async unassignRoleFromUser(
    tenantId: string,
    userId: string,
    companyRoleId: string,
  ) {
    const role = await this.findById(tenantId, companyRoleId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        companyRole: true,
        permissionSets: { select: { permissionSetId: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');

    if (user.companyRoleId !== companyRoleId) {
      throw new BadRequestException('User is not assigned to this role');
    }

    // Remove the current role's permission set
    const currentSetName = `${role.name} Set`;
    const currentSet = await this.prisma.permissionSet.findFirst({
      where: { tenantId, name: currentSetName, isActive: true },
    });
    if (currentSet) {
      const isAssigned = user.permissionSets.some(
        (ps) => ps.permissionSetId === currentSet.id,
      );
      if (isAssigned) {
        await this.prisma.userPermissionSet.delete({
          where: {
            userId_permissionSetId: { userId, permissionSetId: currentSet.id },
          },
        });
      }
    }

    // Fall back to Employee role — the floor all users must have
    const employeeRole = await this.prisma.companyRole.findFirst({
      where: { tenantId, name: 'Employee', isSystem: true },
    });

    if (employeeRole) {
      const employeeSet = await this.prisma.permissionSet.findFirst({
        where: { tenantId, name: 'Employee Set', isActive: true },
      });
      if (employeeSet) {
        await this.prisma.userPermissionSet.upsert({
          where: {
            userId_permissionSetId: {
              userId,
              permissionSetId: employeeSet.id,
            },
          },
          update: { grantedAt: new Date() },
          create: {
            userId,
            permissionSetId: employeeSet.id,
            grantedBy: 'system',
          },
        });
      }
      return this.prisma.user.update({
        where: { id: userId },
        data: { companyRoleId: employeeRole.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          companyRoleId: true,
          companyRole: { select: { id: true, name: true } },
        },
      });
    }

    this.logger.warn(
      `Employee system role not found for tenant ${tenantId} — clearing companyRoleId without fallback`,
    );
    return this.prisma.user.update({
      where: { id: userId },
      data: { companyRoleId: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyRoleId: true,
      },
    });
  }
}
