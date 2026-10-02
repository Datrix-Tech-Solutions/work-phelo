import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimmedUppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateEntityTypeDto {
  @ApiProperty({ example: 'Customer' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    example: 'SUP',
    description:
      'Short ID used as the prefix of Entity Codes for this type (e.g. SUP-0001). Unique per tenant.',
  })
  @Transform(trimmedUppercase)
  @IsString()
  @Matches(/^[A-Z0-9]{1,10}$/, {
    message: 'ID must be 1-10 letters or digits',
  })
  code!: string;
}

export class UpdateEntityTypeDto extends PartialType(CreateEntityTypeDto) {}
