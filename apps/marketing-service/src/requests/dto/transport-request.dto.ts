import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MarketingTransportPurpose,
  MarketingTransportRequestStatus,
  MarketingTransportStopKind,
  MarketingVehicleCondition,
} from '../../../prisma/generated/client';

/**
 * Statuses a request can be filtered by. ON_ROUTE is not stored: it is an approved
 * request that someone has started.
 */
export const REQUEST_STATUS_FILTERS = [
  ...Object.values(MarketingTransportRequestStatus),
  'ON_ROUTE',
] as const;
export type RequestStatusFilter = (typeof REQUEST_STATUS_FILTERS)[number];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PASSENGERS = 20;
const MAX_STOPS = 10;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : value;
const trimOnly = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** A client or prospect a trip goes to. */
export class TransportStopDto {
  @ApiProperty({ enum: MarketingTransportStopKind })
  @IsEnum(MarketingTransportStopKind)
  kind!: MarketingTransportStopKind;

  @ApiProperty({ format: 'uuid', description: 'The client or prospect ID.' })
  @IsUUID()
  id!: string;
}

export class CreateTransportRequestDto {
  @ApiProperty({
    enum: MarketingTransportPurpose,
    description:
      'Whether the trip is personal, for marketing or for operations.',
  })
  @IsEnum(MarketingTransportPurpose)
  purpose!: MarketingTransportPurpose;

  @ApiProperty({
    example: '2026-10-20',
    description: 'Travel date (YYYY-MM-DD).',
  })
  @Matches(DATE_PATTERN, { message: 'travelDate must be in YYYY-MM-DD format' })
  travelDate!: string;

  @ApiProperty({
    example: '08:30',
    description: 'Expected departure time (24h HH:mm).',
  })
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiPropertyOptional({
    example: '17:00',
    description:
      'Expected return time (24h HH:mm). Optional: a trip without one holds its vehicle and driver until it is completed.',
  })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'An approved appointment this trip is for. The purpose becomes marketing and the appointment’s prospect is always a destination; stops adds more.',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({
    description:
      'Free-text destination and purpose, used for personal trips instead of picking clients or prospects.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  destination?: string;

  @ApiPropertyOptional({
    type: [TransportStopDto],
    description: 'Clients or prospects the trip goes to.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STOPS)
  @ValidateNested({ each: true })
  @Type(() => TransportStopDto)
  stops?: TransportStopDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'HR employee IDs travelling with the requester.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PASSENGERS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  passengerIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTransportRequestDto {
  @ApiPropertyOptional({ enum: MarketingTransportPurpose })
  @IsOptional()
  @IsEnum(MarketingTransportPurpose)
  purpose?: MarketingTransportPurpose;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'travelDate must be in YYYY-MM-DD format' })
  travelDate?: string;

  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime?: string;

  @ApiPropertyOptional({
    example: '17:00',
    nullable: true,
    description: 'Null clears the return time.',
  })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime?: string | null;

  @ApiPropertyOptional({
    description:
      'Free-text destination and purpose, used for personal trips. Replaces the saved destination.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  destination?: string;

  @ApiPropertyOptional({
    type: [TransportStopDto],
    description: 'Replaces the destinations; an empty array removes them all.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STOPS)
  @ValidateNested({ each: true })
  @Type(() => TransportStopDto)
  stops?: TransportStopDto[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Replaces the passenger list; an empty array removes everyone.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PASSENGERS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  passengerIds?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Empty string clears the notes.',
  })
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewTransportRequestDto {
  @ApiPropertyOptional({
    description: 'Optional note, e.g. the reason for rejecting.',
  })
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveTransportRequestDto extends ReviewTransportRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'HR asset ID of the vehicle to allocate.',
  })
  @IsUUID()
  vehicleAssetId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'HR employee ID of a transport officer to drive. Required unless selfDriven is true.',
  })
  @IsOptional()
  @IsUUID()
  driverEmployeeId?: string;

  @ApiPropertyOptional({
    description:
      'True when the requester drives themselves, so no driver is assigned. Cannot be combined with driverEmployeeId.',
  })
  @IsOptional()
  @IsBoolean()
  selfDriven?: boolean;
}

export class RescheduleTransportRequestDto extends ApproveTransportRequestDto {
  @ApiProperty({
    example: '2026-10-20',
    description: 'New travel date (YYYY-MM-DD).',
  })
  @Matches(DATE_PATTERN, { message: 'travelDate must be in YYYY-MM-DD format' })
  travelDate!: string;

  @ApiProperty({
    example: '14:00',
    description: 'New departure time (24h HH:mm).',
  })
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiPropertyOptional({
    example: '17:00',
    description:
      'New return time (24h HH:mm). Optional; leave out for a trip with no planned return.',
  })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime?: string;
}

export class CompleteTransportRequestDto {
  @ApiProperty({
    example: '12:40',
    description:
      'When the vehicle actually got back (24h HH:mm, on the travel date).',
  })
  @Matches(TIME_PATTERN, {
    message: 'actualReturnTime must be in HH:mm format',
  })
  actualReturnTime!: string;

  @ApiPropertyOptional({
    example: 48390,
    description:
      'Odometer reading on return; not below the starting mileage. Optional.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  endingMileage?: number;

  @ApiProperty({ enum: MarketingVehicleCondition })
  @IsEnum(MarketingVehicleCondition)
  endingCondition!: MarketingVehicleCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    type: [TransportStopDto],
    description:
      'Further clients or prospects actually visited, added to the ones planned.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STOPS)
  @ValidateNested({ each: true })
  @Type(() => TransportStopDto)
  stops?: TransportStopDto[];
}

export class StartTransportRequestDto {
  @ApiProperty({
    example: '08:40',
    description:
      'When the vehicle actually left (24h HH:mm); not in the future on the travel day.',
  })
  @Matches(TIME_PATTERN, {
    message: 'actualDepartureTime must be in HH:mm format',
  })
  actualDepartureTime!: string;

  @ApiProperty({
    example: 48210,
    description: 'Odometer reading at departure.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  startingMileage!: number;

  @ApiProperty({ enum: MarketingVehicleCondition })
  @IsEnum(MarketingVehicleCondition)
  startingCondition!: MarketingVehicleCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class DestinationOptionsQueryDto {
  @ApiPropertyOptional({ description: 'Matches the company name.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AllocationOptionsQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-20',
    description:
      'Check availability for this date instead of the request’s own (for rescheduling).',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'travelDate must be in YYYY-MM-DD format' })
  travelDate?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime?: string;
}

export class QueryTransportRequestsDto {
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

  @ApiPropertyOptional({
    description: 'Matches purpose, destination or requester name.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: REQUEST_STATUS_FILTERS,
    isArray: true,
    description:
      'One or more statuses, comma-separated. APPROVED means approved and not yet started; ON_ROUTE means approved, started and not yet completed.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsIn(REQUEST_STATUS_FILTERS, { each: true })
  status?: RequestStatusFilter[];
}
