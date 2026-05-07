import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudienceType } from '../../../prisma/generated/client';

export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'Announcement title',
    example: 'Office closure on Friday',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: 'Announcement body content',
    example:
      'The office will be closed this Friday for maintenance. Remote teams are unaffected.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    description: 'Who should receive this announcement',
    enum: AnnouncementAudienceType,
    example: AnnouncementAudienceType.ALL,
  })
  @IsOptional()
  @IsEnum(AnnouncementAudienceType)
  audienceType?: AnnouncementAudienceType;

  @ApiPropertyOptional({
    description: 'Department IDs to target when audienceType=DEPARTMENTS',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({
    description: 'Branch IDs to target when audienceType=BRANCHES',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({
    description: 'Employee IDs to target when audienceType=EMPLOYEES',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({
    description: 'Whether to email the matched recipients when published',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Optional expiry date after which the announcement is hidden',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
