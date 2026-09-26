import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEntityTypeDto {
  @ApiProperty({ example: 'Customer' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class UpdateEntityTypeDto extends PartialType(CreateEntityTypeDto) {}
