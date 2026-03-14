import { IsEmail, IsString, IsEnum } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenantSlug!: string;

  @IsEnum(['email', 'sms'])
  method!: 'email' | 'sms';
}
