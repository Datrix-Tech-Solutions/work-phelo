import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementParticipantStatus } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdatePlacementParticipantStatusDto {
  @ApiProperty({
    enum: PlacementParticipantStatus,
    example: PlacementParticipantStatus.ACCEPTED,
  })
  @IsEnum(PlacementParticipantStatus)
  status!: PlacementParticipantStatus;

  @ApiPropertyOptional({
    example: 'Reinsurer accepted 20% line by email.',
    maxLength: 1000,
    description:
      'Optional broker note retained on the participant when supplied.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
