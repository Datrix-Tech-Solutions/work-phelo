import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const ARCHIVE_KINDS = [
  'JOURNAL',
  'CASHBOOK',
  'INVOICE',
  'CREDIT_NOTE',
  'RECEIPT',
  'BILL',
  'DEBIT_NOTE',
  'PAYMENT',
] as const;

export class QueryArchiveDto {
  @ApiPropertyOptional({ enum: ARCHIVE_KINDS })
  @IsOptional()
  @IsIn(ARCHIVE_KINDS)
  kind?: (typeof ARCHIVE_KINDS)[number];

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ArchiveEntryRefDto {
  @ApiProperty({ enum: ARCHIVE_KINDS })
  @IsIn(ARCHIVE_KINDS)
  kind!: (typeof ARCHIVE_KINDS)[number];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

export class DeleteArchivedEntriesDto {
  @ApiProperty({ type: [ArchiveEntryRefDto], minItems: 1, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ArchiveEntryRefDto)
  items!: ArchiveEntryRefDto[];
}
