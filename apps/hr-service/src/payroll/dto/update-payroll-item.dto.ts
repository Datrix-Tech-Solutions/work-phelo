import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePayrollItemDto {
  @ApiPropertyOptional({
    description: 'Override basic salary for this payroll run item',
    example: 4500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basicSalary?: number;

  @ApiPropertyOptional({
    description: 'Override non-transport allowances for this payroll run item',
    example: 350,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAllowances?: number;

  @ApiPropertyOptional({
    description: 'Optional transport amount for this payroll run item',
    example: 120,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transportAmount?: number;

  @ApiPropertyOptional({
    description: 'Optional deductions such as loans or employee balances owed',
    example: 250,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherDeductions?: number;
}
