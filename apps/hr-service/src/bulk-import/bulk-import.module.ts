import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { DepartmentsModule } from '../departments/departments.module';
import { EmployeesModule } from '../employees/employees.module';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';

@Module({
  imports: [BranchesModule, DepartmentsModule, EmployeesModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}
