import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** A tax on a bill or invoice. The amount is the tax type's rate × the document amount,
 *  worked out by the server; the account is where it posts. */
export class DocumentTaxDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taxTypeId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  glAccountId!: string;
}

/** A deduction (reduces what is owed, e.g. a trade discount) or a charge (adds to it, e.g.
 *  delivery) typed on a bill or invoice form. */
export class DocumentAdjustmentDto {
  @ApiProperty({ enum: ['DEDUCTION', 'CHARGE'] })
  @IsIn(['DEDUCTION', 'CHARGE'])
  kind!: 'DEDUCTION' | 'CHARGE';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  glAccountId!: string;

  @ApiProperty({ example: 500, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional({ example: 'Trade discount' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}
