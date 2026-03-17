import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateCompanyRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
