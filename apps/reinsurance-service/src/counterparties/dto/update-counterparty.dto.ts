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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CounterpartyType } from '../../../prisma/generated/client';
import { CreateCounterpartyAddressDto } from './create-counterparty-address.dto';
import { CreateCounterpartyContactDto } from './create-counterparty-contact.dto';
import { TrimmedString } from './string.transforms';

export class UpdateCounterpartyDto {
  @ApiPropertyOptional({
    enum: CounterpartyType,
    example: CounterpartyType.REINSURER,
  })
  @IsOptional()
  @IsEnum(CounterpartyType)
  type?: CounterpartyType;

  @ApiPropertyOptional({
    example: 'Acme Insurance Ltd',
    minLength: 2,
    maxLength: 200,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'C-00123', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'operations@acme.example', maxLength: 200 })
  @TrimmedString()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+233201234567', maxLength: 50 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.example', maxLength: 2048 })
  @TrimmedString()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: 'Priority cedant account', maxLength: 2000 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateCounterpartyContactDto],
    maxItems: 50,
    description:
      'When supplied, replaces the complete stored contact collection.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyContactDto)
  contacts?: CreateCounterpartyContactDto[];

  @ApiPropertyOptional({
    type: [CreateCounterpartyAddressDto],
    maxItems: 20,
    description:
      'When supplied, replaces the complete stored address collection.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateCounterpartyAddressDto)
  addresses?: CreateCounterpartyAddressDto[];
}
