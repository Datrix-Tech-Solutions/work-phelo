import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  RecruitmentInterviewMode,
  RecruitmentInterviewStatus,
} from '../../../prisma/generated/client';

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export class CreateRecruitmentInterviewDto {
  @ApiProperty({
    enum: RecruitmentInterviewMode,
    description: 'How the interview is held',
    example: RecruitmentInterviewMode.VIDEO,
  })
  @IsEnum(RecruitmentInterviewMode)
  mode!: RecruitmentInterviewMode;

  @ApiProperty({
    description: 'Start of the interview as an ISO 8601 date-time',
    example: '2026-10-20T10:00:00.000Z',
  })
  @IsDateString({ strict: true })
  scheduledAt!: string;

  @ApiProperty({
    description: 'Length of the interview in minutes',
    minimum: 5,
    maximum: 480,
    example: 45,
  })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @ApiPropertyOptional({
    description: 'VIDEO only: the meeting platform, e.g. Google Meet',
    example: 'Google Meet',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string | null;

  @ApiPropertyOptional({
    description: 'VIDEO only: the join link (http or https)',
    example: 'https://meet.google.com/abc-defg-hij',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  meetingLink?: string | null;

  @ApiPropertyOptional({
    description:
      'PHONE only: the number to call, in international E.164 format',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, {
    message: 'phone must include a country code in international format',
  })
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'IN_PERSON only: where the interview takes place',
    example: 'Head Office, Accra - 3rd floor',
    maxLength: 240,
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string | null;

  @ApiPropertyOptional({
    description: 'Context or instructions for the interview',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateRecruitmentInterviewDto {
  @ApiPropertyOptional({ enum: RecruitmentInterviewMode })
  @IsOptional()
  @IsEnum(RecruitmentInterviewMode)
  mode?: RecruitmentInterviewMode;

  @ApiPropertyOptional({
    description: 'New start of the interview as an ISO 8601 date-time',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  scheduledAt?: string;

  @ApiPropertyOptional({ minimum: 5, maximum: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  meetingLink?: string | null;

  @ApiPropertyOptional({ example: '+233201234567' })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, {
    message: 'phone must include a country code in international format',
  })
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({
    enum: RecruitmentInterviewStatus,
    description:
      'Mark a scheduled interview COMPLETED or CANCELLED. SCHEDULED is only the starting state.',
  })
  @IsOptional()
  @IsEnum(RecruitmentInterviewStatus)
  status?: RecruitmentInterviewStatus;

  @ApiPropertyOptional({
    description: 'Interview outcome or feedback, kept with the interview',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string | null;

  @ApiPropertyOptional({
    description:
      'Only with status COMPLETED: the stage to move the candidate to. Omit to keep them in the Interview stage. Applied and Screening are not allowed.',
  })
  @IsOptional()
  @IsUUID()
  stageId?: string;
}
