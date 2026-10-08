import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_COMPONENTS,
  PAYSLIP_TYPE_KEYS,
  type PayslipTypeKey,
} from '../payroll-configuration.constants';

export class SavePayrollConfigurationDto {
  @ApiProperty({ example: 'Ghana monthly payroll' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: PAYSLIP_TYPE_KEYS,
    description:
      'The payslip type, which decides the figures the configuration is calculated from. Several ' +
      'configurations can share a type; payroll groups choose which one they use.',
  })
  @IsIn(PAYSLIP_TYPE_KEYS)
  payslipType!: PayslipTypeKey;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'The pay components. Checked and cleaned on save; see the pay component rules.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_COMPONENTS)
  components!: unknown[];

  @ApiPropertyOptional({
    example: '2026-10-01',
    description:
      'The date a new version starts to apply. Required whenever the components changed, and ' +
      "can't be before the previous version's date.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be YYYY-MM-DD',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: 'New PAYE bands from the 2027 budget' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description:
      'When updating: the latest version number the caller was editing. If someone saved a newer ' +
      'version in the meantime the update is refused, so nobody overwrites it unseen.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseVersion?: number;
}
