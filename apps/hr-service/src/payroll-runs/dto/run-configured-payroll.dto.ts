import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAYSLIP_TYPE_KEYS,
  type PayslipTypeKey,
} from '../../payroll-configuration/payroll-configuration.constants';

export class RunConfiguredPayrollDto {
  @ApiProperty({
    enum: PAYSLIP_TYPE_KEYS,
    description:
      'The payslip type to run. Each type has its own run each month.',
  })
  @IsIn(PAYSLIP_TYPE_KEYS)
  payslipType!: PayslipTypeKey;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({
    type: Object,
    description:
      'The commission figure (for example sales) typed in for each employee, by employee id.',
  })
  @IsOptional()
  @IsObject()
  commissionFigures?: Record<string, number>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Amounts typed in for this run for components that are entered each run, by employee id and then component id.',
  })
  @IsOptional()
  @IsObject()
  amounts?: Record<string, Record<string, number>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ApprovePayrollMonthDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({ description: 'A note recorded with the approval.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
