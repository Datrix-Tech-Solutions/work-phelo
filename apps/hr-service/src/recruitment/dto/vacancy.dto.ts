import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EmploymentType,
  RecruitmentQuestionType,
  RecruitmentVacancyStatus,
} from '../../../prisma/generated/client';

export class RecruitmentVacancyQuestionDto {
  @ApiPropertyOptional({ description: 'Existing question UUID when updating' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Why are you interested in this role?' })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question!: string;

  @ApiPropertyOptional({
    enum: RecruitmentQuestionType,
    default: RecruitmentQuestionType.TEXT,
  })
  @IsOptional()
  @IsEnum(RecruitmentQuestionType)
  type?: RecruitmentQuestionType;

  @ApiPropertyOptional({
    description:
      'Allowed option labels for SINGLE_SELECT or MULTI_SELECT questions',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  options?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  sortOrder?: number;
}

export class CreateRecruitmentVacancyDto {
  @ApiPropertyOptional({
    description:
      'Vacancy title. Required before a vacancy can transition to OPEN.',
    example: 'People Operations Manager',
    minLength: 2,
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({
    description:
      'Role location. Required before a vacancy can transition to OPEN.',
    example: 'Accra, Ghana',
    minLength: 2,
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  location?: string;

  @ApiPropertyOptional({
    description:
      'Employment type. Required before a vacancy can transition to OPEN.',
    enum: EmploymentType,
    example: EmploymentType.FULL_TIME,
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  jobType?: EmploymentType;

  @ApiPropertyOptional({
    description:
      'Public vacancy overview/description. Required before OPEN status.',
    minLength: 10,
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Public vacancy responsibilities',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  responsibilities?: string;

  @ApiPropertyOptional({
    description: 'Public vacancy requirements or qualifications',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  requirements?: string;

  @ApiPropertyOptional({
    description: 'Minimum salary where the tenant chooses to publish a range',
    minimum: 0,
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum salary where the tenant chooses to publish a range',
    minimum: 0,
    example: 9000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'Three-letter salary currency code',
    example: 'GHS',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  salaryCurrency?: string;

  @ApiPropertyOptional({
    description:
      'Vacancy lifecycle status. Transitioning to OPEN validates required publishing fields.',
    enum: RecruitmentVacancyStatus,
    example: RecruitmentVacancyStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(RecruitmentVacancyStatus)
  status?: RecruitmentVacancyStatus;

  @ApiPropertyOptional({
    description:
      'Employer-defined application questions shown to applicants for this vacancy',
    type: [RecruitmentVacancyQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecruitmentVacancyQuestionDto)
  questions?: RecruitmentVacancyQuestionDto[];
}

export class UpdateRecruitmentVacancyDto extends PartialType(
  CreateRecruitmentVacancyDto,
) {}

export class QueryRecruitmentVacanciesDto {
  @ApiPropertyOptional({
    description: 'Filter vacancies by lifecycle status',
    enum: RecruitmentVacancyStatus,
  })
  @IsOptional()
  @IsEnum(RecruitmentVacancyStatus)
  status?: RecruitmentVacancyStatus;

  @ApiPropertyOptional({
    description: 'Search vacancy title or location',
    example: 'operations',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    minimum: 1,
    maximum: 100,
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryPublicRecruitmentVacanciesDto {
  @ApiProperty({
    description:
      'Tenant identifier for public job board lookups. This remains explicit until public tenant slug resolution is introduced.',
    example: 'tenant-uuid',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  tenantId!: string;

  @ApiPropertyOptional({
    description: 'Search open vacancy title or location',
    example: 'operations',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    minimum: 1,
    maximum: 100,
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
