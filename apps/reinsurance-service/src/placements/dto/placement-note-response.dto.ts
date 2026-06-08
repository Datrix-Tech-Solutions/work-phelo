import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
} from '../../../prisma/generated/client';

export class PlacementNoteCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;
}

export class PlacementNoteParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;
}

export class PlacementNoteClosingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CLO-001' })
  closingNumber!: string;
}

export class PlacementNoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  closingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  participantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Reserved for future settlement linkage.',
  })
  settledByPaymentId!: string | null;

  @ApiProperty({
    enum: PlacementNoteType,
    example: PlacementNoteType.DEBIT_NOTE,
  })
  type!: PlacementNoteType;

  @ApiProperty({
    enum: PlacementNoteDirection,
    example: PlacementNoteDirection.CEDANT_TO_BROKER,
  })
  direction!: PlacementNoteDirection;

  @ApiProperty({ example: 'DN-001' })
  noteNumber!: string;

  @ApiProperty({
    enum: PlacementNoteStatus,
    example: PlacementNoteStatus.DRAFT,
  })
  status!: PlacementNoteStatus;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: String, example: '4500.00' })
  grossAmount!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '10.0000' })
  commissionPercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '450.00' })
  commissionAmount!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7.50' })
  brokeragePercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '337.50' })
  brokerageAmount!: string | null;

  @ApiProperty({ type: String, example: '0.0000' })
  nicLevyPercent!: string;

  @ApiProperty({ type: String, example: '0.00' })
  nicLevyAmount!: string;

  @ApiProperty({ type: String, example: '0.0000' })
  withholdingTaxPercent!: string;

  @ApiProperty({ type: String, example: '0.00' })
  withholdingTaxAmount!: string;

  @ApiProperty({ type: String, example: '3712.50' })
  netAmount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  noteDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  issuedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  voidedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  voidReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementNoteCounterpartyDto })
  counterparty!: PlacementNoteCounterpartyDto;

  @ApiPropertyOptional({ type: PlacementNoteParticipantDto, nullable: true })
  participant!: PlacementNoteParticipantDto | null;

  @ApiPropertyOptional({ type: PlacementNoteClosingDto, nullable: true })
  closing!: PlacementNoteClosingDto | null;
}

export class PlacementNoteListResponseDto {
  @ApiProperty({ type: [PlacementNoteResponseDto] })
  items!: PlacementNoteResponseDto[];
}
