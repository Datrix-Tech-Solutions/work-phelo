import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateCompanyRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, string[]>;
}
