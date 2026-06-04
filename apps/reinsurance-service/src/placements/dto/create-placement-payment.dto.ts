import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementPaymentDirection,
  PlacementPaymentType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

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
      'Required for REINSURER_DISBURSEMENT. Omit for placement-level cedant premium received.',
  })
  @IsOptional()
  @IsUUID()
  closingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for REINSURER_DISBURSEMENT. Omit for placement-level cedant premium received.',
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
      'MVP requires this to match the placement currency exactly. FX support is deferred.',
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

  @ApiPropertyOptional({
    example: 'Partial cedant premium receipt',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
