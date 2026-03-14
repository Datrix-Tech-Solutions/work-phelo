import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  HR_STAFF = 'HR_STAFF',
  EMPLOYEE = 'EMPLOYEE',
  ACCOUNTANT = 'ACCOUNTANT',
  MARKETING_MANAGER = 'MARKETING_MANAGER',
  MARKETING_STAFF = 'MARKETING_STAFF',
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
