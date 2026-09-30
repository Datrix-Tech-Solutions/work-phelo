import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalCollapseWhitespaceString } from '../../crm-settings/dto/string.transforms';

export enum ProspectFollowUpStatusDto {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ProspectFollowUpSourceDto {
  EXPLICIT = 'EXPLICIT',
  DEFAULT = 'DEFAULT',
}

export enum ProspectFollowUpUrgencyDto {
  OVERDUE = 'OVERDUE',
  UPCOMING = 'UPCOMING',
  FUTURE = 'FUTURE',
}

export class CreateProspectFollowUpDto {
  @ApiProperty({ example: '2026-10-07T09:00:00.000Z' })
  @IsDateString()
  dueAt!: string;

  @ApiPropertyOptional({
    example: 'Call finance director with renewal options.',
    maxLength: 1000,
  })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateProspectFollowUpDto {
  @ApiPropertyOptional({ example: '2026-10-08T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({
    example: 'Rescheduled after client travel.',
    maxLength: 1000,
  })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ProspectFollowUpResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  prospectId!: string;

  @ApiProperty()
  dueAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ enum: ProspectFollowUpStatusDto })
  status!: ProspectFollowUpStatusDto;

  @ApiPropertyOptional({ nullable: true })
  createdByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completedInteractionId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ProspectFollowUpHistoryResponseDto {
  @ApiProperty({ type: [ProspectFollowUpResponseDto] })
  items!: ProspectFollowUpResponseDto[];
}

export class ProspectFollowUpWorklistItemDto {
  @ApiProperty()
  prospectId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty()
  assignedUserId!: string;

  @ApiPropertyOptional({ nullable: true })
  followUpId!: string | null;

  @ApiProperty()
  dueAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ enum: ProspectFollowUpSourceDto })
  followUpSource!: ProspectFollowUpSourceDto;

  @ApiProperty({ enum: ProspectFollowUpUrgencyDto })
  urgency!: ProspectFollowUpUrgencyDto;

  @ApiPropertyOptional({ nullable: true })
  lastInteractionDate!: Date | null;
}

export class ProspectFollowUpWorklistResponseDto {
  @ApiProperty({ type: [ProspectFollowUpWorklistItemDto] })
  items!: ProspectFollowUpWorklistItemDto[];
}
