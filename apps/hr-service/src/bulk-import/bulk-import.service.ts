import { Injectable } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service';
import { DepartmentsService } from '../departments/departments.service';
import { EmployeesService } from '../employees/employees.service';
import { BulkImportCompanyDto } from './dto/bulk-import-company.dto';

@Injectable()
export class BulkImportService {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly departmentsService: DepartmentsService,
    private readonly employeesService: EmployeesService,
  ) {}

  /** Runs Branches, then Departments, then Employees in sequence — each entity's own
   *  bulkImport() re-reads the database fresh, so a branch/department created earlier in this
   *  same call is already visible (as a real committed row) by the time later sheets reference
   *  it by name. */
  async importCompany(tenantId: string, dto: BulkImportCompanyDto) {
    const branches = dto.branches?.length
      ? await this.branchesService.bulkImport(tenantId, dto.branches)
      : [];
    const departments = dto.departments?.length
      ? await this.departmentsService.bulkImport(tenantId, dto.departments)
      : [];
    const employees = dto.employees?.length
      ? await this.employeesService.bulkImport(tenantId, dto.employees)
      : [];

    return { branches, departments, employees };
  }
}
