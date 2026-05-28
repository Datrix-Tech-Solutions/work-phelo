import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementParticipantRole } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreatePlacementParticipantDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant-owned counterparty participating in the placement.',
  })
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty({
    enum: PlacementParticipantRole,
    example: PlacementParticipantRole.LEAD_REINSURER,
  })
  @IsEnum(PlacementParticipantRole)
  role!: PlacementParticipantRole;

  @ApiPropertyOptional({
    example: 45,
    minimum: 0,
    maximum: 100,
    description: 'Target or offered participation percentage.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  sharePercent?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    maximum: 100,
    description: 'Signed line percentage after bind.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  signedLinePercent?: number;

  @ApiPropertyOptional({ example: 'Lead market indication', maxLength: 1000 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
