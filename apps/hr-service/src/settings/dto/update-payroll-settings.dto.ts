import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePayrollSettingsDto {
  @ApiPropertyOptional({
    description:
      'Whether Tier 3 employee contributions are enabled for payroll',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  payrollTier3Enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Tier 3 employee contribution percentage of basic salary',
    example: 5,
    minimum: 0,
    maximum: 16,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(16)
  payrollTier3Rate?: number;

  @ApiPropertyOptional({
    description: 'Display name of the Tier 3 trustee or scheme',
    example: 'Enterprise Trustees Tier 3',
  })
  @IsOptional()
  @IsString()
  payrollTier3SchemeName?: string;
}
