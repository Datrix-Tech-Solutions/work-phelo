import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';

export const MAX_REPS_PER_TARGET = 100;

export class CreateSalesTargetDto {
  @ApiProperty({
    example: 'Q1 2026 revenue',
    description:
      'What the target is called. Every rep in the request gets a target with this name.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'The sales reps the target is set for. Each gets their own target of the full amount.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REPS_PER_TARGET)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds!: string[];

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
    description:
      "Revenue each rep is to receive, in the tenant's base currency.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;
}

/** Who and what are fixed once a target exists; the amount and the dates can change. */
export class UpdateSalesTargetDto {
  @ApiProperty({ example: 60000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'New first day, inclusive. Dates cannot be changed once the target has ended.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'New last day, inclusive.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
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
