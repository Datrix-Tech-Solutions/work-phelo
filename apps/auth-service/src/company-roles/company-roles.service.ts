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

@Injectable()
export class CompanyRolesService {
  private readonly logger = new Logger(CompanyRolesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.companyRole.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: dto.permissions ?? {
          hr: 'none',
          accounting: 'none',
          marketing: 'none',
        },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyRoleDto) {
    await this.findById(tenantId, id);
    const role = await this.findById(tenantId, id);
    if (role.isSystem) {
      throw new ForbiddenException('Default roles cannot be edited');
    }
    return this.prisma.companyRole.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions && { permissions: dto.permissions }),
      },
    });
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
      include: {
        companyRole: true,
        permissionSets: { select: { permissionSetId: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');

    // ── Swap permission sets ──────────────────────────────────────────────────
    // Remove the permission set that matched the previous role (if any),
    // then assign the one that matches the new role.
    // Convention: a role named "Manager" has a matching set named "Manager Set".

    if (user.companyRole) {
      const oldSetName = `${user.companyRole.name} Set`;
      const oldSet = await this.prisma.permissionSet.findFirst({
        where: { tenantId, name: oldSetName, isActive: true },
      });
      if (oldSet) {
        const isAssigned = user.permissionSets.some(
          (ps) => ps.permissionSetId === oldSet.id,
        );
        if (isAssigned) {
          await this.prisma.userPermissionSet.delete({
            where: {
              userId_permissionSetId: { userId, permissionSetId: oldSet.id },
            },
          });
        }
      }
    }

    const newSetName = `${newRole.name} Set`;
    const newSet = await this.prisma.permissionSet.findFirst({
      where: { tenantId, name: newSetName, isActive: true },
    });

    if (newSet) {
      await this.prisma.userPermissionSet.upsert({
        where: {
          userId_permissionSetId: { userId, permissionSetId: newSet.id },
        },
        update: { grantedBy: assignedBy, grantedAt: new Date() },
        create: {
          userId,
          permissionSetId: newSet.id,
          grantedBy: assignedBy,
        },
      });
    } else {
      this.logger.warn(
        `No permission set found for role "${newRole.name}" (looked for "${newSetName}") in tenant ${tenantId}`,
      );
    }

    // ── Update the user's company role ────────────────────────────────────────
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
