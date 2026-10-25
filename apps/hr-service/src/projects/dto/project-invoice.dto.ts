import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineDto {
  @ApiProperty({
    description: 'Task id, milestone id, a retainer month, or "price"',
  })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: "For a task's time: the minutes billed" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minutes?: number;
}

/** Records an invoice that has already been raised in Accounting. */
export class RecordProjectInvoiceDto {
  @ApiProperty({
    description:
      'The submission id the invoice was raised with; recording it twice returns the first record',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'The Accounting transaction the invoice became' })
  @IsString()
  @MinLength(1)
  transactionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999_999)
  amount!: number;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
