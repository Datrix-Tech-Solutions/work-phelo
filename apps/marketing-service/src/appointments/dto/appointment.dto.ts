import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MarketingAppointmentStatus } from '../../../prisma/generated/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const trimOnly = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;
const toArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? value.split(',') : undefined;
};

export class CreateAppointmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A prospect assigned to the marketer.',
  })
  @IsUUID()
  prospectId!: string;

  @ApiProperty({ example: '2026-10-20', description: 'YYYY-MM-DD.' })
  @Matches(DATE_PATTERN, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @ApiProperty({ example: '09:00', description: '24h HH:mm.' })
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @ApiPropertyOptional({
    example: '10:00',
    description: '24h HH:mm; must be after startTime.',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Who the appointment is for. Defaults to the caller; naming anyone else needs marketing.appointments.all:CREATE.',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  marketerUserId?: string;

  @ApiPropertyOptional()
  @Transform(trimOnly)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @ApiPropertyOptional({
    example: '10:00',
    description: 'Send an empty string to clear the end time.',
  })
  @IsOptional()
  @Matches(/^(([01]\d|2[0-3]):[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @ApiPropertyOptional()
  @Transform(trimOnly)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ApproveAppointmentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional manager to assign; must have marketing access.',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  managerUserId?: string;

  @ApiPropertyOptional()
  @Transform(trimOnly)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class ReviewAppointmentDto {
  @ApiPropertyOptional()
  @Transform(trimOnly)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class QueryAppointmentsDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'First day, inclusive.',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from must be in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Last day, inclusive.',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to must be in YYYY-MM-DD format' })
  to?: string;

  @ApiPropertyOptional({ enum: MarketingAppointmentStatus, isArray: true })
  @Transform(toArray)
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(Object.values(MarketingAppointmentStatus), { each: true })
  status?: MarketingAppointmentStatus[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  marketerUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Cap the result, e.g. the 5 upcoming. Defaults to all in range.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AppointmentFormOptionsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Whose prospects to list. Only honoured with marketing.appointments.all:CREATE; otherwise it is the caller.',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  marketerUserId?: string;

  @ApiPropertyOptional({ description: 'Filter prospects by company name.' })
  @Transform(trimOnly)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
