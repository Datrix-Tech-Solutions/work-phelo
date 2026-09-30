import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CollapseWhitespaceString,
  OptionalCollapseWhitespaceString,
} from '../../crm-settings/dto/string.transforms';

export class ProspectInteractionParticipantDto {
  @ApiProperty({ example: 'Ama Mensah', maxLength: 160 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: '+233201234567', maxLength: 40 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  @ApiProperty({ example: 'Finance Director', maxLength: 120 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  role!: string;
}

export class CreateProspectInteractionDto {
  @ApiProperty({ example: '2026-09-30T10:30:00.000Z' })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'Active CRM Settings interaction-medium option ID.',
  })
  @IsUUID()
  interactionMediumId!: string;

  @ApiPropertyOptional({
    example: 'Discussed renewal requirements.',
    maxLength: 1000,
  })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    example: true,
    description: 'Whether the interaction involved a decision maker.',
  })
  @IsBoolean()
  decisionMakerInvolved!: boolean;

  @ApiPropertyOptional({ type: [ProspectInteractionParticipantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProspectInteractionParticipantDto)
  participants?: ProspectInteractionParticipantDto[];

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description:
      'Pending follow-up of this prospect that this interaction completes. It is marked COMPLETED and linked to the new interaction in the same transaction.',
  })
  @IsOptional()
  @IsUUID()
  followUpId?: string;
}
