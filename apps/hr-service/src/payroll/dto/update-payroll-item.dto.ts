import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollAllowanceLineItemDto {
  @ApiPropertyOptional({ example: 'Transport Allowance' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'TRANSPORT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ example: 250, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class PayrollDeductionLineItemDto {
  @ApiPropertyOptional({
    description:
      'Source employee deduction ID when the line item comes from an employee balance',
  })
  @IsOptional()
  @IsString()
  employeeDeductionId?: string;

  @ApiPropertyOptional({ example: 'Staff Loan' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 250, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

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

  @ApiPropertyOptional({
    type: [PayrollAllowanceLineItemDto],
    description:
      'Optional itemized allowance snapshot. If provided, totals are derived from these line items.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAllowanceLineItemDto)
  allowanceItems?: PayrollAllowanceLineItemDto[];

  @ApiPropertyOptional({
    type: [PayrollDeductionLineItemDto],
    description:
      'Optional itemized deduction snapshot. If provided, totals are derived from these line items.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollDeductionLineItemDto)
  deductionItems?: PayrollDeductionLineItemDto[];
}
