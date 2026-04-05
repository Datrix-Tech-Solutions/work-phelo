import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyRoleDto } from './dto/create-company-role.dto';
import { UpdateCompanyRoleDto } from './dto/update-company-role.dto';

@Injectable()
export class CompanyRolesService {
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
