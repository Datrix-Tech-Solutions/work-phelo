import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EntityAccountingRelation } from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEntityTypeDto {
  @ApiProperty({ example: 'Customer' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;

  // Stored as-is, not read by any posting logic — descriptive only for now.
  @ApiProperty({ enum: EntityAccountingRelation })
  @IsEnum(EntityAccountingRelation)
  accountingRelation!: EntityAccountingRelation;
}

export class UpdateEntityTypeDto extends PartialType(CreateEntityTypeDto) {}
