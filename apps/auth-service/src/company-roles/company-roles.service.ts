import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyRoleDto } from './dto/create-company-role.dto';
import { UpdateCompanyRoleDto } from './dto/update-company-role.dto';
import { COMPANY_ROLE_PERMISSIONS } from '@work-phelo/config';

@Injectable()
export class CompanyRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultRoles(tenantId: string) {
    const defaultRoles = ['Company Admin', 'Manager', 'Employee'];
    for (const roleName of defaultRoles) {
      const permissions = COMPANY_ROLE_PERMISSIONS[roleName] || [];
      await this.prisma.companyRole.upsert({
        where: { tenantId_name: { tenantId, name: roleName } },
        update: {},
        create: {
          tenantId,
          name: roleName,
          isSystem: true,
          permissions: {
            create: permissions.map((p) => ({ permission: p })),
          },
        },
      });
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.companyRole.findMany({
      where: { tenantId, isActive: true },
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const role = await this.prisma.companyRole.findFirst({
      where: { id, tenantId },
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { users: true } },
      },
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
        permissions: {
          create: dto.permissions.map((p) => ({ permission: p })),
        },
      },
      include: { permissions: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyRoleDto) {
    await this.findById(tenantId, id);
    if (dto.permissions) {
      await this.prisma.companyRolePermission.deleteMany({
        where: { companyRoleId: id },
      });
      await this.prisma.companyRolePermission.createMany({
        data: dto.permissions.map((p) => ({
          companyRoleId: id,
          permission: p,
        })),
      });
    }
    return this.prisma.companyRole.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { permissions: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const role = await this.findById(tenantId, id);
    if (role.isSystem)
      throw new ForbiddenException('System roles cannot be deleted');
    if (role._count.users > 0) {
      throw new ConflictException(
        'Cannot delete a role that has users assigned to it',
      );
    }
    return this.prisma.companyRole.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignRoleToUser(
    tenantId: string,
    userId: string,
    companyRoleId: string,
  ) {
    await this.findById(tenantId, companyRoleId);
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
      },
    });
  }
}
