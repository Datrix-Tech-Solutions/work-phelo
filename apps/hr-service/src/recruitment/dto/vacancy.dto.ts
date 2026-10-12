import { PartialType } from '@nestjs/swagger';
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
  RecruitmentVacancyStatus,
} from '../../../prisma/generated/client';

export class RecruitmentVacancyQuestionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  sortOrder?: number;
}

export class CreateRecruitmentVacancyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  jobType?: EmploymentType;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  responsibilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  requirements?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsEnum(RecruitmentVacancyStatus)
  status?: RecruitmentVacancyStatus;

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
  @IsOptional()
  @IsEnum(RecruitmentVacancyStatus)
  status?: RecruitmentVacancyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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

export class QueryPublicRecruitmentVacanciesDto {
  @IsString()
  @MaxLength(120)
  tenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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
