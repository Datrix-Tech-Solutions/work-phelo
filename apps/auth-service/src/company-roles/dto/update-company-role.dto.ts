import { IsString, IsOptional } from 'class-validator';

export class UpdateCompanyRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
