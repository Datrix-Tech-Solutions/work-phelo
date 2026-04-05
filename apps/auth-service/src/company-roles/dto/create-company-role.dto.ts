import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateCompanyRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'none' | 'view' | 'edit'>;
}
