import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SourceModule } from '../../../../prisma/generated/client';

/** Trims and collapses inner whitespace, leaving non-strings for the validators to reject. */
const collapseWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class SourceTransactionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ enum: SourceModule, example: 'MARKETING' })
  @IsEnum(SourceModule)
  sourceModule!: SourceModule;
}

export class ListSourceTransactionsQueryDto extends SourceTransactionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entityId!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateSourceTransactionDto extends SourceTransactionsQueryDto {
  @ApiProperty({
    description:
      'Stable per submission. Sending it again returns the transaction already raised instead of creating another.',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @ApiProperty({
    description:
      "The calling module's own record the transaction is for (e.g. a client id).",
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  externalRef!: string;

  @ApiProperty({
    description: "Name of the record - becomes the entity's name.",
    maxLength: 200,
  })
  @Transform(collapseWhitespace)
  @IsString()
  @MaxLength(200)
  entityName!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'First transaction for the record: the entity is created under this entity type.',
  })
  @IsOptional()
  @IsUUID()
  entityTypeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Later transactions: the entity returned for the first one.',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A Receivable transaction type linked to the source.',
  })
  @IsUUID()
  transactionTypeId!: string;

  @ApiProperty({
    example: 20000,
    description:
      "In the tenant's base currency. It cannot be changed in Accounting.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(collapseWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ReceiptsSummaryDto extends SourceTransactionsQueryDto {
  @ApiProperty({
    type: [String],
    description: 'Entities to total received money for.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  entityIds!: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Transactions to report the received amount of, one by one.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  transactionIds?: string[];
}
