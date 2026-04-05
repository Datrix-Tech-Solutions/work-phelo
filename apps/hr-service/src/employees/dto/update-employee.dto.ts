import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmploymentType,
  EmploymentStatus,
  Gender,
  MaritalStatus,
} from '../../../prisma/generated/client';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Updated first name', example: 'Kofi' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Updated last name', example: 'Boateng' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Updated phone number',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Updated gender', example: 'MALE' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Updated birth date',
    example: '1990-05-18',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Updated marital status',
    example: 'MARRIED',
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ description: 'Updated nationality', example: 'Ghana' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Updated street address',
    example: '321 Tema Road',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Updated city', example: 'Accra' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Updated region',
    example: 'Greater Accra',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact name',
    example: 'Ama Mensah',
  })
  @IsOptional()
  @IsString()
  emergencyName?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact phone',
    example: '+233245678901',
  })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({
    description: 'Updated emergency contact relation',
    example: 'Spouse',
  })
  @IsOptional()
  @IsString()
  emergencyRelation?: string;

  @ApiPropertyOptional({
    description: 'Updated department ID',
    example: 'dept-456',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Updated job title',
    example: 'HR Manager',
  })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({
    description: 'Updated employment type',
    example: 'FULL_TIME',
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    description: 'Updated employment status',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({
    description: 'Updated bank name',
    example: 'GCB Bank',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Updated bank account number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Updated bank branch',
    example: 'Accra Main Branch',
  })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({
    description: 'Updated SSNIT number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  ssnit?: string;

  @ApiPropertyOptional({ description: 'Updated TIN', example: 'TIN123456789' })
  @IsOptional()
  @IsString()
  tinNumber?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Updated basic salary amount',
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicSalary?: number;
}
