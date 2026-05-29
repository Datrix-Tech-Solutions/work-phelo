import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementParticipantRole,
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';
import { ApiErrorResponseDto } from '../../counterparties/dto/counterparty-response.dto';

export { ApiErrorResponseDto };

export class PlacementCounterpartySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.CEDANT })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Acme Insurance Ltd' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'C-00123' })
  registrationNumber!: string | null;
}

export class PlacementParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementParticipantRole,
    example: PlacementParticipantRole.LEAD_REINSURER,
  })
  role!: PlacementParticipantRole;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '45.0000',
    description: 'Decimal value returned as a JSON string by Prisma.',
  })
  sharePercent!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '25.0000',
    description: 'Decimal value returned as a JSON string by Prisma.',
  })
  signedLinePercent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Lead market' })
  notes!: string | null;

  @ApiProperty({ type: PlacementCounterpartySummaryDto })
  counterparty!: PlacementCounterpartySummaryDto;
}

export class PlacementStatusHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    enum: PlacementStatus,
    nullable: true,
    example: PlacementStatus.DRAFT,
  })
  fromStatus!: PlacementStatus | null;

  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.MARKETING })
  toStatus!: PlacementStatus;

  @ApiProperty({ format: 'uuid' })
  changedByUserId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Moved to market.',
  })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PlacementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  reference!: string;

  @ApiProperty({ example: 'fac-2026-0001' })
  normalizedReference!: string;

  @ApiProperty({ example: 'Acme Energy Facultative Placement' })
  title!: string;

  @ApiProperty({ enum: PlacementType, example: PlacementType.FACULTATIVE })
  placementType!: PlacementType;

  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.DRAFT })
  status!: PlacementStatus;

  @ApiProperty({ format: 'uuid' })
  cedantId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'MOTOR' })
  classOfBusiness!: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { vehicle_make: 'Toyota', vehicle_model: 'Camry' },
    description:
      'Business-class-specific risk details keyed by field definitions.',
  })
  businessDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { coverage_type: 'comprehensive', deductible: 5000 },
    description: 'Offer-specific details keyed by field definitions.',
  })
  offerDetails!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Facultative placement for upstream energy risk.',
  })
  description!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  inceptionDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  expiryDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '16.500000',
    description:
      'Exchange rate to the tenant base currency, snapshotted at placement creation or when currency was last changed. Decimal returned as a JSON string by Prisma.',
  })
  exchangeRateToBase!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5000000.00',
    description: 'Decimal value returned as a JSON string by Prisma.',
  })
  sumInsured!: string | null;

  @ApiProperty({ type: PlacementCounterpartySummaryDto })
  cedant!: PlacementCounterpartySummaryDto;

  @ApiProperty({ type: [PlacementParticipantResponseDto] })
  participants!: PlacementParticipantResponseDto[];

  @ApiProperty({ type: [PlacementStatusHistoryResponseDto] })
  statusHistory!: PlacementStatusHistoryResponseDto[];

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  archivedByUserId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PlacementsPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 34, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  totalPages!: number;
}

export class PaginatedPlacementsResponseDto {
  @ApiProperty({ type: [PlacementResponseDto] })
  items!: PlacementResponseDto[];

  @ApiProperty({ type: PlacementsPageMetaDto })
  meta!: PlacementsPageMetaDto;
}
