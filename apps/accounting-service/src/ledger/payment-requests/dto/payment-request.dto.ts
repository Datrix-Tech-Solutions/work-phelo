import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
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
import {
  AccountingPaymentRequestStatus,
  AccountingSettlementMethod,
} from '../../../../prisma/generated/client';
import { SourceTransactionsQueryDto } from '../../source-transactions/dto/source-transaction.dto';

const collapseWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/** A module asking Accounting to record that its record's payer paid part or all of an invoice. */
export class CreatePaymentRequestDto extends SourceTransactionsQueryDto {
  @ApiProperty({
    description:
      'Stable per submission. Sending it again returns the request already raised.',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @ApiProperty({
    description: "The module's own record (e.g. the client id).",
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  externalRef!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The posted invoice being paid.',
  })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({
    example: 5000,
    description:
      'In the invoice currency. Cannot exceed what can still be claimed.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000_000)
  amount!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'When the payer paid. Not in the future.',
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(collapseWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(collapseWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Shown to the accountant beside the request.',
  })
  @Transform(collapseWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestedByName?: string;
}

export class CancelPaymentRequestDto extends SourceTransactionsQueryDto {
  @ApiProperty({
    description: "The module's own record the request is for.",
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  externalRef!: string;
}

/** Where and how the money arrived - what only the accountant knows. */
export class CompletePaymentRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'The date the money was received.',
  })
  @IsDateString()
  receiptDate!: string;
}

export class QueryPaymentRequestsDto {
  @ApiPropertyOptional({
    enum: AccountingPaymentRequestStatus,
    default: 'PENDING',
  })
  @IsOptional()
  @IsEnum(AccountingPaymentRequestStatus)
  status?: AccountingPaymentRequestStatus;

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
