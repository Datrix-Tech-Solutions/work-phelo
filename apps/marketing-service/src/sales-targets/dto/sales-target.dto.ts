import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
} from 'class-validator';

export class CreateSalesTargetDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The sales rep the target is for.',
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'CRM Settings product. Leave out for the rep’s total across every product.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: '2026-01-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ example: '2026-03-31', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiProperty({
    example: 50000,
    description: "Revenue to receive, in the tenant's base currency.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;
}

/** Who, what and when are fixed once a target exists; only the amount can change. */
export class UpdateSalesTargetDto {
  @ApiProperty({ example: 60000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;
}

export class QuerySalesTargetsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only this rep’s targets.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'Only targets whose period includes this day (YYYY-MM-DD).',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;
}
