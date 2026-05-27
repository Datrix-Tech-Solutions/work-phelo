import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TrimmedString } from './string.transforms';

export class CreateCounterpartyContactDto {
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @TrimmedString()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
