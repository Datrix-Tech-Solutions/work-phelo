import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecruiterConfirmEmailDto {
  @ApiProperty({ description: 'Token from the confirmation link' })
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;
}

export class RecruiterResendConfirmationDto {
  @ApiProperty({ example: 'abena@acmeghana.com' })
  @IsEmail()
  email!: string;
}
