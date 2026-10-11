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
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryRecruitmentCandidatesDto {
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsDateString()
  appliedFrom?: string;

  @IsOptional()
  @IsDateString()
  appliedTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateRecruitmentCandidateStageDto {
  @IsUUID()
  stageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateRecruitmentApplicationDto {
  @IsUUID()
  vacancyId!: string;

  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  professionalSummary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  education?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expectedSalary?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  expectedSalaryCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  noticePeriod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resumeFileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverLetterUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverLetterFileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  githubUrl?: string;
}
