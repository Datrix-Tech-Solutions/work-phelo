import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdatePlacementStatusDto {
  @ApiProperty({ enum: PlacementStatus, example: PlacementStatus.MARKETING })
  @IsEnum(PlacementStatus)
  status!: PlacementStatus;

  @ApiPropertyOptional({
    example: 'Moved to market after broker review.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
