import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

export enum UserSystemRole {
  EMPLOYEE = 'EMPLOYEE',
  TENANT_ADMIN = 'TENANT_ADMIN',
}

export class InviteUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEnum(UserSystemRole)
  role?: UserSystemRole;
}
