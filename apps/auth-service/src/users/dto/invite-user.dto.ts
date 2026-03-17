import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export enum UserSystemRole {
  EMPLOYEE = 'EMPLOYEE',
  TENANT_ADMIN = 'TENANT_ADMIN',
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
  @IsEnum(UserSystemRole)
  role?: UserSystemRole;

  @IsOptional()
  @IsString()
  companyRoleId?: string;
}
