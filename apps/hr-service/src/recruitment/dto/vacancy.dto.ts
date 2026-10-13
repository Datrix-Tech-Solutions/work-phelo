import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
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
  RecruitmentSalaryType,
  RecruitmentVacancyStatus,
  WorkMode,
} from '../../../prisma/generated/client';
import { RECRUITMENT_EDUCATION_LEVEL_CODES } from '../vacancy-requirements';

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
    description:
      'How the question is answered. YES_NO implies the options Yes and No; MULTIPLE_CHOICE, CHECKBOXES and DROPDOWN require options.',
    enum: RecruitmentQuestionType,
    default: RecruitmentQuestionType.SHORT_ANSWER,
  })
  @IsOptional()
  @IsEnum(RecruitmentQuestionType)
  type?: RecruitmentQuestionType;

  @ApiPropertyOptional({
    description:
      'Allowed option labels for MULTIPLE_CHOICE, CHECKBOXES and DROPDOWN questions',
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

export class RecruitmentEducationRequirementDto {
  @ApiProperty({
    description: 'Accepted education levels',
    type: [String],
    enum: RECRUITMENT_EDUCATION_LEVEL_CODES,
  })
  @IsArray()
  @ArrayMaxSize(RECRUITMENT_EDUCATION_LEVEL_CODES.length)
  @IsIn(RECRUITMENT_EDUCATION_LEVEL_CODES, { each: true })
  levels!: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class RecruitmentExperienceRequirementDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  minYears?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  maxYears?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class RecruitmentListRequirementDto {
  @ApiProperty({ type: [String], example: ['Excel', 'Payroll'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(120, { each: true })
  items!: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class RecruitmentDocumentRequirementsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  resume?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  coverLetter?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  portfolio?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  github?: boolean;
}

export class RecruitmentVacancyDetailsDto {
  @ApiPropertyOptional({ type: RecruitmentEducationRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentEducationRequirementDto)
  education?: RecruitmentEducationRequirementDto;

  @ApiPropertyOptional({ type: RecruitmentExperienceRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentExperienceRequirementDto)
  experience?: RecruitmentExperienceRequirementDto;

  @ApiPropertyOptional({ type: RecruitmentListRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentListRequirementDto)
  skills?: RecruitmentListRequirementDto;

  @ApiPropertyOptional({ type: RecruitmentListRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentListRequirementDto)
  languages?: RecruitmentListRequirementDto;

  @ApiPropertyOptional({ type: RecruitmentListRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentListRequirementDto)
  certificates?: RecruitmentListRequirementDto;

  @ApiPropertyOptional({ type: RecruitmentDocumentRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentDocumentRequirementsDto)
  documents?: RecruitmentDocumentRequirementsDto;
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
  title?: string | null;

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
  location?: string | null;

  @ApiPropertyOptional({ description: 'City of the role', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({
    description: 'Department the role belongs to; null clears it',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({
    description: 'Branch the role is based at; null clears it',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ enum: WorkMode, example: WorkMode.HYBRID })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiPropertyOptional({
    description: 'Number of open positions',
    minimum: 1,
    maximum: 1000,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  vacancies?: number;

  @ApiPropertyOptional({
    description:
      'Last day applications are accepted (YYYY-MM-DD); null clears it',
    example: '2026-11-15',
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  closingDate?: string | null;

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
    description: 'Job summary, as plain text. Required before OPEN status.',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Key responsibilities, as plain text',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  responsibilities?: string | null;

  @ApiPropertyOptional({
    description: 'Perks and benefits, as plain text',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  perksAndBenefits?: string | null;

  @ApiPropertyOptional({
    description:
      'Structured requirements. When provided, `requirements` is generated from it unless sent explicitly; null clears it.',
    type: RecruitmentVacancyDetailsDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentVacancyDetailsDto)
  details?: RecruitmentVacancyDetailsDto | null;

  @ApiPropertyOptional({
    description:
      'Plain-text requirements shown on the public posting. Generated from `details` when omitted.',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  requirements?: string | null;

  @ApiPropertyOptional({
    description:
      'How the salary is presented. FIXED uses salaryAmount, RANGE uses salaryMin and salaryMax, NEGOTIABLE and NON_DISCLOSED carry no amount. Inferred from the amounts when omitted.',
    enum: RecruitmentSalaryType,
  })
  @IsOptional()
  @IsEnum(RecruitmentSalaryType)
  salaryType?: RecruitmentSalaryType;

  @ApiPropertyOptional({
    description: 'Salary when salaryType is FIXED',
    minimum: 0,
    example: 7000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryAmount?: number;

  @ApiPropertyOptional({
    description: 'Minimum salary when salaryType is RANGE',
    minimum: 0,
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum salary when salaryType is RANGE',
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

export class QueryPublicRecruitmentBoardDto {
  @ApiPropertyOptional({
    description: 'Search title, company, city or location',
    example: 'engineer',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  jobType?: EmploymentType;

  @ApiPropertyOptional({ enum: WorkMode })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

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
