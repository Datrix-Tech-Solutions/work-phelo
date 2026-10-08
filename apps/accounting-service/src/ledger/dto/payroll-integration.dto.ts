import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SeedPayrollAccountItemDto {
  @ApiProperty({
    example: 'net-pay-payable',
    description:
      'Stable key identifying which default payroll account this is.',
  })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'Net Pay Payable' })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({
    example: true,
    description:
      'False skips creating this specific account (the tenant opted out of it).',
  })
  @IsBoolean()
  include!: boolean;
}

export class SeedPayrollAccountsDto {
  @ApiProperty({ type: [SeedPayrollAccountItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeedPayrollAccountItemDto)
  items!: SeedPayrollAccountItemDto[];
}

export class PostPayrollAccrualDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'The HR payroll run this accrual is for.' })
  @IsString()
  payrollRunId!: string;

  @ApiProperty({ example: 'March 2026' })
  @IsString()
  @MaxLength(80)
  periodLabel!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description:
      "Date the accrual is recorded on — the payroll run's period end date.",
  })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({
    description: 'Sum of PayrollItem.grossSalary across the run.',
  })
  @IsNumber()
  @Min(0)
  totalGross!: number;

  @ApiProperty({ description: 'Sum of PayrollItem.netSalary across the run.' })
  @IsNumber()
  @Min(0)
  totalNet!: number;

  @ApiProperty({ description: 'Sum of PayrollItem.payeTax across the run.' })
  @IsNumber()
  @Min(0)
  totalPAYE!: number;

  @ApiProperty({
    description: 'Sum of PayrollItem.tier1Contribution (employee, true SSNIT).',
  })
  @IsNumber()
  @Min(0)
  totalTier1!: number;

  @ApiProperty({
    description:
      'Sum of PayrollItem.tier2Contribution (employee, mandatory, folded into SSNIT here).',
  })
  @IsNumber()
  @Min(0)
  totalTier2!: number;

  @ApiProperty({
    description:
      'Sum of PayrollItem.tier3Employee (voluntary private-trustee pension).',
  })
  @IsNumber()
  @Min(0)
  totalTier3!: number;

  @ApiProperty({
    description:
      'grossSalary + employerSSNIT summed — employer SSNIT alone is this minus totalGross.',
  })
  @IsNumber()
  @Min(0)
  totalEmployerCost!: number;

  @ApiPropertyOptional({
    description: 'Sum of PayrollItem.otherDeductions across the run.',
  })
  @IsNumber()
  @Min(0)
  totalOtherDeductions!: number;
}

export class PostPayrollRoleAccrualDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'The HR payroll run this accrual is for.' })
  @IsString()
  payrollRunId!: string;

  @ApiProperty({ example: '10/2026' })
  @IsString()
  @MaxLength(80)
  periodLabel!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description:
      "Date the accrual is recorded on - the payroll run's period end date.",
  })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({ description: 'Salary and wages: gross pay for the run.' })
  @IsNumber()
  @Min(0)
  totalGross!: number;

  @ApiProperty({ description: 'Net pay for the run.' })
  @IsNumber()
  @Min(0)
  totalNet!: number;

  @ApiProperty({ description: 'Income tax withheld, after any tax credits.' })
  @IsNumber()
  @Min(0)
  totalIncomeTax!: number;

  @ApiProperty({
    description: "Employees' social security contributions withheld.",
  })
  @IsNumber()
  @Min(0)
  totalEmployeeSocialSecurity!: number;

  @ApiProperty({
    description: "The employer's own social security contribution.",
  })
  @IsNumber()
  @Min(0)
  totalEmployerSocialSecurity!: number;

  @ApiProperty({ description: 'Pension withheld, owed to a private fund.' })
  @IsNumber()
  @Min(0)
  totalPension!: number;

  @ApiProperty({
    description: 'Other amounts withheld from pay, such as loan repayments.',
  })
  @IsNumber()
  @Min(0)
  totalOtherDeductions!: number;
}

export class QueryPayrollSettlementStatusDto {
  @ApiProperty({ description: 'Tenant the payroll run belongs to' })
  @IsUUID()
  tenantId!: string;
}

export class SetPayrollAccountMappingDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'The account that handles this payroll function, or null to clear it.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  glAccountId!: string | null;
}

export class CreatePayrollRoleAccountDto {
  @ApiPropertyOptional({
    example: 'Net Pay Payable',
    description:
      'Name for the new account. Defaults to the standard name for this function.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}

export class UpdatePayrollAccountingSettingsDto {
  @ApiProperty({
    description:
      'Post the accrual journal straight to the ledger instead of leaving it as a draft for review.',
  })
  @IsBoolean()
  autoPostOnApproval!: boolean;
}
