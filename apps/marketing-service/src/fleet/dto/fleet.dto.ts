import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MarketingFleetFuelType,
  MarketingFleetVehicleType,
} from '../../../prisma/generated/client';

const MIN_REGISTRATION_YEAR = 1950;
const MAX_REGISTRATION_YEAR = new Date().getFullYear() + 1;
const MAX_MILEAGE = 10_000_000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * Derived status: BOOKED / ON_ROUTE come from approved trips, DOCUMENTS_EXPIRED from an expired
 * insurance or safety certificate, the rest from HR.
 */
export const FLEET_STATUSES = [
  'AVAILABLE',
  'BOOKED',
  'ON_ROUTE',
  'DOCUMENTS_EXPIRED',
  'MAINTENANCE',
  'RETIRED',
] as const;
export type FleetStatus = (typeof FLEET_STATUSES)[number];

export const SETTABLE_FLEET_STATUSES = [
  'AVAILABLE',
  'MAINTENANCE',
  'RETIRED',
] as const;
export type SettableFleetStatus = (typeof SETTABLE_FLEET_STATUSES)[number];

/** An optional YYYY-MM-DD date; null clears it on update. */
const OptionalDay = (description: string) =>
  applyDecorators(
    ApiPropertyOptional({
      example: '2026-10-16',
      nullable: true,
      description,
    }),
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use the format YYYY-MM-DD' }),
    IsISO8601({ strict: true }),
  );

class FleetDetailsFields {
  @ApiProperty({ enum: MarketingFleetVehicleType })
  @IsEnum(MarketingFleetVehicleType)
  vehicleType!: MarketingFleetVehicleType;

  @ApiProperty({ example: 'Toyota' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make!: string;

  @ApiProperty({ example: 'Hilux' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @ApiProperty({ example: 2022 })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REGISTRATION_YEAR)
  @Max(MAX_REGISTRATION_YEAR)
  yearOfRegistration!: number;

  @ApiProperty({ enum: MarketingFleetFuelType })
  @IsEnum(MarketingFleetFuelType)
  fuelType!: MarketingFleetFuelType;

  @ApiPropertyOptional({
    example: 45000,
    nullable: true,
    description: 'Odometer reading in km. Optional.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MILEAGE)
  currentMileage?: number | null;

  @OptionalDay('Insurance start date. Needs an expiry date too.')
  insuranceStartDate?: string | null;

  @OptionalDay('Insurance expiry date: the last day it is valid.')
  insuranceExpiryDate?: string | null;

  @OptionalDay(
    'Vehicle safety certificate issue date. Needs an expiry date too.',
  )
  safetyCertificateIssuedOn?: string | null;

  @OptionalDay(
    'Vehicle safety certificate expiry date: the last day it is valid.',
  )
  safetyCertificateExpiresOn?: string | null;
}

export class CreateFleetVehicleDto extends FleetDetailsFields {
  @ApiPropertyOptional({ format: 'uuid', description: 'HR branch ID.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'HR employee ID of the driver to assign.',
  })
  @IsOptional()
  @IsUUID()
  assignedDriverId?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'MAINTENANCE'] })
  @IsOptional()
  @IsIn(['AVAILABLE', 'MAINTENANCE'])
  status?: 'AVAILABLE' | 'MAINTENANCE';
}

export class UpdateFleetVehicleDto {
  @ApiPropertyOptional({ enum: MarketingFleetVehicleType })
  @IsOptional()
  @IsEnum(MarketingFleetVehicleType)
  vehicleType?: MarketingFleetVehicleType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REGISTRATION_YEAR)
  @Max(MAX_REGISTRATION_YEAR)
  yearOfRegistration?: number;

  @ApiPropertyOptional({ enum: MarketingFleetFuelType })
  @IsOptional()
  @IsEnum(MarketingFleetFuelType)
  fuelType?: MarketingFleetFuelType;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null clears the mileage.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MILEAGE)
  currentMileage?: number | null;

  @OptionalDay('Insurance start date. Needs an expiry date too.')
  insuranceStartDate?: string | null;

  @OptionalDay('Insurance expiry date: the last day it is valid.')
  insuranceExpiryDate?: string | null;

  @OptionalDay(
    'Vehicle safety certificate issue date. Needs an expiry date too.',
  )
  safetyCertificateIssuedOn?: string | null;

  @OptionalDay(
    'Vehicle safety certificate expiry date: the last day it is valid.',
  )
  safetyCertificateExpiresOn?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'HR branch ID; null clears the branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}

export class SetFleetVehicleStatusDto {
  @ApiProperty({
    enum: SETTABLE_FLEET_STATUSES,
    description: 'ASSIGNED is derived from driver assignment.',
  })
  @IsIn(SETTABLE_FLEET_STATUSES)
  status!: SettableFleetStatus;
}

export class AssignFleetDriverDto {
  @ApiProperty({ format: 'uuid', description: 'HR employee ID.' })
  @IsUUID()
  employeeId!: string;
}

export class QueryFleetVehiclesDto {
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
    description: 'Matches make, model, asset number, vehicle name or driver.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FLEET_STATUSES })
  @IsOptional()
  @IsIn(FLEET_STATUSES)
  status?: FleetStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: MarketingFleetVehicleType })
  @IsOptional()
  @IsEnum(MarketingFleetVehicleType)
  vehicleType?: MarketingFleetVehicleType;

  @ApiPropertyOptional({ enum: MarketingFleetFuelType })
  @IsOptional()
  @IsEnum(MarketingFleetFuelType)
  fuelType?: MarketingFleetFuelType;
}
