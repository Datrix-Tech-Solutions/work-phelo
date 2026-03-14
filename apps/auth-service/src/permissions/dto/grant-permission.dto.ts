import { IsString, IsEnum, IsOptional } from 'class-validator';

export class GrantPermissionDto {
  @IsString()
  userId!: string;

  @IsString()
  permission!: string;

  @IsEnum(['GRANT', 'REVOKE'])
  effect!: 'GRANT' | 'REVOKE';

  @IsOptional()
  @IsString()
  reason?: string;
}
