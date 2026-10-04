import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { OptionalCollapseWhitespaceString } from '../../crm-settings/dto/string.transforms';

export class ClientBillingDto {
  @ApiProperty({
    format: 'uuid',
    description: "Accounting entity type the client's entity is created under.",
  })
  @IsUUID()
  entityTypeId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Accounting transaction type linked to the marketing source.',
  })
  @IsUUID()
  transactionTypeId!: string;

  @ApiProperty({
    example: 20000,
    description:
      "Amount in the tenant's base currency. It cannot be changed in Accounting.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'CRM Settings product the transaction is for. Stays in marketing - Accounting never receives it.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class RaiseClientBillingDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Generated once per form submission. Sending the same id again never creates a second transaction.',
  })
  @IsUUID()
  submissionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Required for the client's first transaction. Later ones reuse its entity.",
  })
  @IsOptional()
  @IsUUID()
  entityTypeId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  transactionTypeId!: string;

  @ApiProperty({ example: 20000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class QueryClientBillingDto {
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

export enum AccountingEvent {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  REJECTED = 'REJECTED',
}

export class AccountingEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: 'MARKETING' })
  @IsString()
  sourceModule!: string;

  @ApiProperty({ description: "Accounting's id for the transaction." })
  @IsString()
  @MaxLength(100)
  transactionId!: string;

  @ApiProperty({ enum: AccountingEvent })
  @IsEnum(AccountingEvent)
  event!: AccountingEvent;
}
