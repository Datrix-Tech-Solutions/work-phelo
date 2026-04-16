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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmploymentType,
  Gender,
  MaritalStatus,
} from '../../../prisma/generated/client';

export class CreateEmployeeDto {
  @ApiPropertyOptional({
    description:
      'Optional internal user ID to link employee to an existing user record',
    example: 'user-123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Given name of the employee', example: 'Kofi' })
  @IsString()
  firstName!: string;

  @ApiProperty({
    description: 'Family name of the employee',
    example: 'Boateng',
  })
  @IsString()
  lastName!: string;

  @ApiProperty({
    description: 'Employee email address for login and notifications',
    example: 'kofi.boateng@acmeghana.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Contact phone number in international format',
    example: '+233201234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Gender of the employee',
    example: 'MALE',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Date of birth in ISO format',
    example: '1990-05-18',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Marital status of the employee',
    example: 'SINGLE',
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({
    description: 'Country of citizenship',
    example: 'Ghana',
  })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Tema Road',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City of residence', example: 'Accra' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Region or state',
    example: 'Greater Accra',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact name',
    example: 'Ama Mensah',
  })
  @IsOptional()
  @IsString()
  emergencyName?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact phone',
    example: '+233245678901',
  })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({
    description: 'Relation to emergency contact',
    example: 'Spouse',
  })
  @IsOptional()
  @IsString()
  emergencyRelation?: string;

  @ApiProperty({
    description: 'Department ID of the employee',
    example: 'dept-456',
  })
  @IsString()
  departmentId!: string;

  @ApiPropertyOptional({
    description: 'Branch ID of the employee',
    example: 'branch-789',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Employee ID of the reporting manager',
    example: 'emp-123',
  })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ description: 'Job title or role', example: 'HR Manager' })
  @IsString()
  jobTitle!: string;

  @ApiProperty({
    description: 'Type of employment contract',
    example: 'FULL_TIME',
  })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiProperty({ description: 'Official hire date', example: '2026-01-05' })
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional({
    description: 'End date of probation period',
    example: '2026-04-05',
  })
  @IsOptional()
  @IsDateString()
  probationEndsAt?: string;

  @ApiPropertyOptional({
    description: 'End date of contract (CONTRACT employment type)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({
    description: 'National ID number',
    example: 'GHA-000000000-0',
  })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({
    description: 'Bank name for salary payments',
    example: 'GCB Bank',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Bank branch name',
    example: 'Accra Main Branch',
  })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({
    description: 'SSNIT number or national social security number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  ssnit?: string;

  @ApiPropertyOptional({
    description: 'Tax identification number',
    example: 'TIN123456789',
  })
  @IsOptional()
  @IsString()
  tinNumber?: string;

  @ApiPropertyOptional({
    description: 'Basic salary amount in local currency',
    example: 3500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicSalary?: number;
}
