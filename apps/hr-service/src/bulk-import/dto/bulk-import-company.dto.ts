import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BranchImportRowDto } from '../../branches/dto/bulk-import-branches.dto';
import { DepartmentImportRowDto } from '../../departments/dto/bulk-import-departments.dto';
import { EmployeeImportRowDto } from '../../employees/dto/bulk-import-employees.dto';

export class BulkImportCompanyDto {
  @ApiPropertyOptional({ type: [BranchImportRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchImportRowDto)
  branches?: BranchImportRowDto[];

  @ApiPropertyOptional({ type: [DepartmentImportRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentImportRowDto)
  departments?: DepartmentImportRowDto[];

  @ApiPropertyOptional({ type: [EmployeeImportRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeImportRowDto)
  employees?: EmployeeImportRowDto[];
}
