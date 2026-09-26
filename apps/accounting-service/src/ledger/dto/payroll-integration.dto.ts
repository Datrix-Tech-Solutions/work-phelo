import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
