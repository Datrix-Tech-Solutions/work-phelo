import { IsString, IsOptional, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  otpCode?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
