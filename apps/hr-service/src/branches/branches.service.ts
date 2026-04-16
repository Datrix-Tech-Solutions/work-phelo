import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A branch with this name already exists');

    return this.prisma.branch.create({
      data: { tenantId, ...dto },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { employees: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch._count.employees > 0) {
      throw new ConflictException(
        'This branch has employees assigned to it and cannot be deleted. Reassign employees before deleting.',
      );
    }

    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
