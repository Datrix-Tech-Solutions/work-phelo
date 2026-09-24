import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentImportRowDto } from './dto/bulk-import-departments.dto';
import { BulkImportRowResult } from '../common/bulk-import.types';
import {
  matchByExactName,
  matchEmployeeByFullName,
} from '../common/name-match.util';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A department with this name already exists');

    let branchId = dto.branchId;
    if (!branchId) {
      const headOffice = await this.prisma.branch.findFirst({
        where: { tenantId, isHeadOffice: true, isActive: true },
      });
      branchId = headOffice?.id;
    }

    return this.prisma.department.create({
      data: { tenantId, ...dto, branchId },
      include: { branch: true },
    });
  }

  /** Creates departments from bulk-import rows sequentially, one row at a time, so a later row
   *  can already see departments/branches created earlier in the same request. Department Head
   *  and Branch are optional name lookups — if they don't resolve, they're dropped with a warning
   *  rather than failing the row (Branch then falls back to the create() head-office default). */
  async bulkImport(
    tenantId: string,
    rows: DepartmentImportRowDto[],
  ): Promise<BulkImportRowResult[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true },
    });
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });

    const results: BulkImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = row.rowNumber ?? i + 1;
      const warnings: string[] = [];

      let managerId: string | undefined;
      if (row.managerName?.trim()) {
        const match = matchEmployeeByFullName(row.managerName, employees);
        if (match.status === 'found') {
          managerId = match.id;
        } else {
          warnings.push(
            match.status === 'ambiguous'
              ? `Department Head "${row.managerName}" matches multiple employees — left blank.`
              : `Department Head "${row.managerName}" not found — left blank.`,
          );
        }
      }

      let branchId: string | undefined;
      if (row.branchName?.trim()) {
        const branch = matchByExactName(row.branchName, branches);
        if (branch) {
          branchId = branch.id;
        } else {
          warnings.push(
            `Branch "${row.branchName}" not found — left blank (defaults to head office).`,
          );
        }
      }

      try {
        const department = await this.create(tenantId, {
          name: row.name,
          description: row.description,
          managerId,
          branchId,
        });
        results.push({
          rowNumber,
          status: 'created',
          id: department.id,
          warnings,
        });
      } catch (err) {
        results.push({
          rowNumber,
          status: 'failed',
          message:
            err instanceof Error ? err.message : 'Failed to create department',
          warnings,
        });
      }
    }

    return results;
  }

  async findAll(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } }, branch: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOptions(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
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
        children: true,
        branch: true,
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findById(tenantId, id);

    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, tenantId },
      });
      if (!manager) throw new NotFoundException('Manager not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, tenantId, isActive: true },
      });
      if (!parent) throw new NotFoundException('Parent department not found');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, isActive: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: { branch: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const dept = await this.findById(tenantId, id);
    if (dept.employees.length > 0) {
      throw new ConflictException(
        'This department has employees assigned to it and cannot be deleted. Reassign employees before deleting.',
      );
    }
    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
