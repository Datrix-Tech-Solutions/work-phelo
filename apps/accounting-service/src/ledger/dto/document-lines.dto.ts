import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** One item on a bill or invoice: what it was for, which account it posts to, and its amount. */
export class DocumentLineDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The account this item posts to. Must sit inside the transaction type rule's scope; leave it out when the rule fixes one account.",
  })
  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @ApiProperty({ example: 1000, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0.0001,
    description:
      'Optional descriptive quantity. Sent together with unitPrice; amount must equal quantity × unitPrice rounded to 2 decimals.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional({ example: 500, minimum: 0.0001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Cleaning supplies' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional active cost centre (department) for this item, carried onto its journal line when posted.',
  })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;
}
