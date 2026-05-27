import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TrimmedString, UppercaseTrimmedString } from './string.transforms';

export class CreateCounterpartyAddressDto {
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  line1!: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @UppercaseTrimmedString()
  @IsString()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
