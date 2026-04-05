import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmploymentType,
  Gender,
  MaritalStatus,
} from '../../../prisma/generated/client';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  emergencyRelation?: string;

  @IsString()
  departmentId!: string;

  @IsString()
  jobTitle!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsDateString()
  hireDate!: string;

  @IsOptional()
  @IsDateString()
  probationEndsAt?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankBranch?: string;

  @IsOptional()
  @IsString()
  ssnit?: string;

  @IsOptional()
  @IsString()
  tinNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicSalary?: number;
}
