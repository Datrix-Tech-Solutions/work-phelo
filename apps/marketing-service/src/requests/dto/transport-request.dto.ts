import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MarketingTransportRequestStatus } from '../../../prisma/generated/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PASSENGERS = 20;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : value;
const trimOnly = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTransportRequestDto {
  @ApiProperty({ example: 'Client site visit and contract signing' })
  @Transform(trimOnly)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  businessPurpose!: string;

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

  @ApiProperty({
    example: '17:00',
    description: 'Expected return time (24h HH:mm).',
  })
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime!: string;

  @ApiProperty({ example: 'Kumasi' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  destination!: string;

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
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  businessPurpose?: string;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'travelDate must be in YYYY-MM-DD format' })
  travelDate?: string;

  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'returnTime must be in HH:mm format' })
  returnTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  destination?: string;

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

  @ApiProperty({
    format: 'uuid',
    description: 'HR employee ID of the driver to allocate.',
  })
  @IsUUID()
  driverEmployeeId!: string;
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
    enum: MarketingTransportRequestStatus,
    isArray: true,
    description: 'One or more statuses, comma-separated.',
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
  @IsEnum(MarketingTransportRequestStatus, { each: true })
  status?: MarketingTransportRequestStatus[];
}
