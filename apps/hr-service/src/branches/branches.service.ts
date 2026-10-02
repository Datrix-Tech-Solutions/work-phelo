import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchImportRowDto } from './dto/bulk-import-branches.dto';
import { BulkImportRowResult } from '../common/bulk-import.types';
import { matchEmployeeByFullName } from '../common/name-match.util';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSingleHeadOffice(
    tenantId: string,
    isHeadOffice?: boolean,
    excludeBranchId?: string,
  ) {
    if (!isHeadOffice) return;

    const existingHeadOffice = await this.prisma.branch.findFirst({
      where: {
        tenantId,
        isActive: true,
        isHeadOffice: true,
        ...(excludeBranchId ? { id: { not: excludeBranchId } } : {}),
      },
      select: { id: true, name: true },
    });

    if (existingHeadOffice) {
      throw new ConflictException(
        `A head office already exists (${existingHeadOffice.name}). Remove that designation before assigning another head office.`,
      );
    }
  }

  async create(tenantId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException('A branch with this name already exists');

    await this.assertSingleHeadOffice(tenantId, dto.isHeadOffice);

    return this.prisma.branch.create({
      data: { tenantId, ...dto },
    });
  }

  /** Creates branches from bulk-import rows sequentially, one row at a time, so a later row
   *  can already see branches created earlier in the same request. Branch Manager is an optional
   *  name lookup — if it doesn't resolve to exactly one employee, it's dropped with a warning
   *  rather than failing the row. */
  async bulkImport(
    tenantId: string,
    rows: BranchImportRowDto[],
  ): Promise<BulkImportRowResult[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true },
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
              ? `Branch Manager "${row.managerName}" matches multiple employees — left blank.`
              : `Branch Manager "${row.managerName}" not found — left blank.`,
          );
        }
      }

      try {
        const branch = await this.create(tenantId, {
          name: row.name,
          code: row.code,
          country: row.country,
          address: row.address,
          city: row.city,
          region: row.region,
          phone: row.phone,
          email: row.email,
          managerId,
          isHeadOffice: row.isHeadOffice,
        });
        results.push({ rowNumber, status: 'created', id: branch.id, warnings });
      } catch (err) {
        results.push({
          rowNumber,
          status: 'failed',
          message:
            err instanceof Error ? err.message : 'Failed to create branch',
          warnings,
        });
      }
    }

    return results;
  }

  async findAll(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOptions(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
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

    await this.assertSingleHeadOffice(tenantId, dto.isHeadOffice, id);

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
