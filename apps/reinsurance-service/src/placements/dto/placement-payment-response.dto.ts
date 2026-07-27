import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
} from '../../../prisma/generated/client';

export class PlacementPaymentCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;
}

export class PlacementPaymentParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;
}

export class PlacementPaymentClosingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CLO-001' })
  closingNumber!: string;
}

export class PlacementPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  closingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  participantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementPaymentType,
    example: PlacementPaymentType.PREMIUM_RECEIVED,
  })
  type!: PlacementPaymentType;

  @ApiProperty({
    enum: PlacementPaymentDirection,
    example: PlacementPaymentDirection.INBOUND,
  })
  direction!: PlacementPaymentDirection;

  @ApiProperty({
    type: String,
    example: '12500.50',
    description: 'Decimal returned as a JSON string by Prisma.',
  })
  amount!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  paymentDate!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'BANK-REF-001',
  })
  reference!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementPaymentStatus,
    example: PlacementPaymentStatus.RECORDED,
  })
  status!: PlacementPaymentStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfPaymentId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementPaymentCounterpartyDto })
  counterparty!: PlacementPaymentCounterpartyDto;

  @ApiPropertyOptional({
    type: PlacementPaymentParticipantDto,
    nullable: true,
  })
  participant!: PlacementPaymentParticipantDto | null;

  @ApiPropertyOptional({ type: PlacementPaymentClosingDto, nullable: true })
  closing!: PlacementPaymentClosingDto | null;

  @ApiPropertyOptional({ type: PlacementPaymentClosingDto, nullable: true })
  endorsementClosing!: PlacementPaymentClosingDto | null;
}

export class PlacementPaymentListResponseDto {
  @ApiProperty({ type: [PlacementPaymentResponseDto] })
  items!: PlacementPaymentResponseDto[];
}
