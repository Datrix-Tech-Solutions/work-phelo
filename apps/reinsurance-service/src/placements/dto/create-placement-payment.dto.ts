import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementPaymentDirection,
  PlacementPaymentType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementPaymentAllocationDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Issued CREDIT_NOTE or ENDORSEMENT_CREDIT_NOTE settled by this reinsurer disbursement.',
  })
  @IsUUID()
  noteId!: string;

  @ApiProperty({
    example: 1000,
    minimum: 0.01,
    description:
      'Positive amount allocated from the payment currency to this obligation.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  allocatedAmount!: number;

  @ApiPropertyOptional({
    example: 1000,
    minimum: 0.01,
    description:
      'Positive obligation amount in the credit-note currency. Defaults to allocatedAmount when currencies match.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  obligationAmount?: number;
}

export class CreatePlacementPaymentDto {
  @ApiProperty({
    enum: PlacementPaymentType,
    example: PlacementPaymentType.PREMIUM_RECEIVED,
    description:
      'Payment category. CLAIM_SETTLEMENT is reserved until the claims domain is implemented.',
  })
  @IsEnum(PlacementPaymentType)
  type!: PlacementPaymentType;

  @ApiProperty({
    enum: PlacementPaymentDirection,
    example: PlacementPaymentDirection.INBOUND,
    description:
      'INBOUND for cedant premium received; OUTBOUND for reinsurer disbursement.',
  })
  @IsEnum(PlacementPaymentDirection)
  direction!: PlacementPaymentDirection;

  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned counterparty involved in the payment.',
  })
  @IsUUID()
  counterpartyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Original placement closing source for REINSURER_DISBURSEMENT. Omit for placement-level cedant premium received and endorsement-closing disbursements.',
  })
  @IsOptional()
  @IsUUID()
  closingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Endorsement closing source for REINSURER_DISBURSEMENT. Omit for placement-level cedant premium received and original-closing disbursements.',
  })
  @IsOptional()
  @IsUUID()
  endorsementClosingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required only when REINSURER_DISBURSEMENT references an original placement closing. Omit for endorsement-closing disbursements and placement-level cedant premium received.',
  })
  @IsOptional()
  @IsUUID()
  participantId?: string;

  @ApiProperty({ example: 12500.5, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    example: 'USD',
    minLength: 3,
    maxLength: 3,
    description:
      'Payment currency. Premium receipts must match the placement currency. Reinsurer disbursements may differ from credit-note currency when agreedExchangeRate is supplied.',
  })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-04T12:00:00.000Z',
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({ example: 'BANK-REF-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'SETTLE-2026-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  settlementReference?: string;

  @ApiPropertyOptional({ example: 'BANK-CONF-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Required for REINSURER_DISBURSEMENT because Finance approved bank confirmation as the accounting boundary.',
  })
  @IsOptional()
  @IsDateString()
  bankConfirmedAt?: string;

  @ApiPropertyOptional({
    example: 12.345678,
    minimum: 0.000001,
    description:
      'Agreed transaction FX rate. Required when payment currency differs from the settled credit-note currency.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    description:
      'Bank charges captured on the transaction. Accounting owns final posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankChargeAmount?: number;

  @ApiPropertyOptional({
    example: 50,
    minimum: 0,
    description:
      'Withholding tax captured on the transaction. Accounting owns final posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  withholdingTaxAmount?: number;

  @ApiPropertyOptional({
    example: 'Partial cedant premium receipt',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    type: [CreatePlacementPaymentAllocationDto],
    description:
      'Required for REINSURER_DISBURSEMENT. Captures one payment to one or more issued credit-note obligations.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePlacementPaymentAllocationDto)
  allocations?: CreatePlacementPaymentAllocationDto[];
}
