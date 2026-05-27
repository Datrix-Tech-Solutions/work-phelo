import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CounterpartyType } from '../../../prisma/generated/client';
import { CreateCounterpartyAddressDto } from './create-counterparty-address.dto';
import { CreateCounterpartyContactDto } from './create-counterparty-contact.dto';
import { TrimmedString } from './string.transforms';

export class CreateCounterpartyDto {
  @IsEnum(CounterpartyType)
  type!: CounterpartyType;

  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

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

  @TrimmedString()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyContactDto)
  contacts?: CreateCounterpartyContactDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyAddressDto)
  addresses?: CreateCounterpartyAddressDto[];
}
