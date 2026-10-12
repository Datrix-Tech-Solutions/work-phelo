import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QueryRecruitmentCandidatesDto {
  @ApiPropertyOptional({
    description: 'Filter submitted candidates by vacancy UUID',
  })
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @ApiPropertyOptional({
    description:
      'Filter submitted candidates by current recruitment stage UUID',
  })
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiPropertyOptional({
    description:
      'Search submitted candidates by first name, last name or email',
    example: 'Ama',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Lower bound for submitted/applied timestamp',
    example: '2026-10-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  appliedFrom?: string;

  @ApiPropertyOptional({
    description: 'Upper bound for submitted/applied timestamp',
    example: '2026-10-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  appliedTo?: string;

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

export class UpdateRecruitmentCandidateStageDto {
  @ApiProperty({
    description: 'Target recruitment stage UUID for a submitted candidate',
  })
  @IsUUID()
  stageId!: string;

  @ApiPropertyOptional({
    description: 'Optional recruiter note for the stage transition',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RecruitmentApplicationAnswerDto {
  @ApiProperty({ description: 'Vacancy question UUID' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Free-text answer for TEXT questions',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  answer?: string;

  @ApiPropertyOptional({
    description:
      'Selected option labels for SINGLE_SELECT or MULTI_SELECT questions',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  selectedOptions?: string[];
}

export class CreateRecruitmentApplicationDto {
  @ApiPropertyOptional({
    description:
      'Vacancy UUID. Public vacancy-scoped routes supply this from the URL.',
  })
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @ApiPropertyOptional({
    description:
      'Applicant first name. Optional while DRAFT; required when submitting.',
    example: 'Ama',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({
    description:
      'Applicant last name. Optional while DRAFT; required when submitting.',
    example: 'Mensah',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'Applicant email. Optional while DRAFT; required and duplicate-checked when submitting.',
    example: 'ama.mensah@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Applicant phone in international E.164 format. Optional while DRAFT; required when submitting.',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must include a country code in international format',
  })
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Applicant country. Optional while DRAFT; required when submitting.',
    example: 'Ghana',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({
    description:
      'Applicant city. Optional while DRAFT; required when submitting.',
    example: 'Accra',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  professionalSummary?: string;

  @ApiPropertyOptional({
    description:
      'Applicant skills. Optional while DRAFT; at least one skill is required when submitting.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  education?: string;

  @ApiPropertyOptional({
    description:
      'Years of experience. Optional while DRAFT; required when submitting.',
    minimum: 0,
    maximum: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsOfExperience?: number;

  @ApiPropertyOptional({
    description:
      'Current job title. Optional while DRAFT; required when submitting.',
    example: 'HR Generalist',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentJobTitle?: string;

  @ApiPropertyOptional({ example: 'Acme Ghana Ltd', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentEmployer?: string;

  @ApiPropertyOptional({
    description:
      'Highest education level. Optional while DRAFT; required when submitting.',
    example: 'Bachelor Degree',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  highestEducationLevel?: string;

  @ApiPropertyOptional({
    description: 'Optional expected salary; not required for submission',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expectedSalary?: number;

  @ApiPropertyOptional({
    description: 'Three-letter currency code for expectedSalary',
    example: 'GHS',
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  expectedSalaryCurrency?: string;

  @ApiPropertyOptional({
    description:
      'Notice period. Optional while DRAFT; required when submitting.',
    example: 'One month',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  noticePeriod?: string;

  @ApiPropertyOptional({
    description:
      'Optional resume URL placeholder until binary upload/storage is introduced',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resumeUrl?: string;

  @ApiPropertyOptional({ description: 'Resume file name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  resumeFileName?: string;

  @ApiPropertyOptional({
    description:
      'Optional cover letter URL placeholder until binary upload/storage is introduced',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverLetterUrl?: string;

  @ApiPropertyOptional({
    description: 'Cover letter file name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverLetterFileName?: string;

  @ApiPropertyOptional({
    description: 'Applicant portfolio URL',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  portfolioUrl?: string;

  @ApiPropertyOptional({ description: 'Applicant GitHub URL', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  githubUrl?: string;

  @ApiPropertyOptional({ type: [RecruitmentApplicationAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecruitmentApplicationAnswerDto)
  answers?: RecruitmentApplicationAnswerDto[];
}

export class UpdateRecruitmentApplicationBasicInfoDto {
  @ApiPropertyOptional({ example: 'Ama', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Mensah', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: 'ama.mensah@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Applicant phone in international E.164 format',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must include a country code in international format',
  })
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Ghana', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: 'Accra', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
}

export class UpdateRecruitmentApplicationProfessionalInfoDto {
  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  professionalSummary?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  education?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ example: 'HR Generalist', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentJobTitle?: string;

  @ApiPropertyOptional({ example: 'Acme Ghana Ltd', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentEmployer?: string;

  @ApiPropertyOptional({ example: 'Bachelor Degree', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  highestEducationLevel?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expectedSalary?: number;

  @ApiPropertyOptional({ example: 'GHS', maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  expectedSalaryCurrency?: string;

  @ApiPropertyOptional({ example: 'One month', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  noticePeriod?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resumeUrl?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  resumeFileName?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverLetterUrl?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverLetterFileName?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  portfolioUrl?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  githubUrl?: string;
}

export class UpdateRecruitmentApplicationAnswersDto {
  @ApiProperty({ type: [RecruitmentApplicationAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecruitmentApplicationAnswerDto)
  answers!: RecruitmentApplicationAnswerDto[];
}
