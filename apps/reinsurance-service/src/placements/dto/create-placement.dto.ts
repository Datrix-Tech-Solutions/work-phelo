import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementType } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';
import { CreatePlacementParticipantDto } from './create-placement-participant.dto';

export class CreatePlacementDto {
  @ApiProperty({
    example: 'FAC-2026-0001',
    minLength: 2,
    maxLength: 80,
    description:
      'Broker-controlled placement reference, unique per tenant while active.',
  })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  reference!: string;

  @ApiProperty({
    example: 'Acme Energy Facultative Placement',
    minLength: 2,
    maxLength: 200,
  })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    enum: PlacementType,
    example: PlacementType.FACULTATIVE,
    default: PlacementType.FACULTATIVE,
  })
  @IsOptional()
  @IsEnum(PlacementType)
  placementType?: PlacementType;

  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned cedant counterparty for the placement.',
  })
  @IsUUID()
  cedantId!: string;

  @ApiPropertyOptional({ example: 'Energy', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classOfBusiness?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Business-class-specific risk details. Keys must match active BusinessClassField definitions for the BUSINESS_DETAILS section of the selected classOfBusiness.',
    example: { vehicle_make: 'Toyota', vehicle_model: 'Camry', year: 2022 },
  })
  @IsOptional()
  @IsObject()
  businessDetails?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Offer-specific details. Keys must match active BusinessClassField definitions for the OFFER_DETAILS section of the selected classOfBusiness.',
    example: { coverage_type: 'comprehensive', deductible: 5000 },
  })
  @IsOptional()
  @IsObject()
  offerDetails?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Facultative placement for upstream energy risk.',
    maxLength: 4000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  inceptionDate?: string;

  @ApiPropertyOptional({ example: '2027-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'USD', minLength: 3, maxLength: 3 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 5000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sumInsured?: number;

  @ApiPropertyOptional({
    type: [CreatePlacementParticipantDto],
    maxItems: 100,
    description:
      'When supplied, participants are stored as the placement market snapshot.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreatePlacementParticipantDto)
  participants?: CreatePlacementParticipantDto[];
}
