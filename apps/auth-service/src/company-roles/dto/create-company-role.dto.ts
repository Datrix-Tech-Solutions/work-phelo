import { IsString, IsOptional } from 'class-validator';

export class CreateCompanyRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
