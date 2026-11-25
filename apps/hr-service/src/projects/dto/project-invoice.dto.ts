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

export class InvoiceLinePersonDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  minutes!: number;
}

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

  @ApiPropertyOptional({
    type: [InvoiceLinePersonDto],
    description: "For a task's time: whose minutes were billed",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLinePersonDto)
  people?: InvoiceLinePersonDto[];
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

/** Raises an invoice for a project client: straight to Accounting, as a draft the accountant completes. */
export class RaiseProjectInvoiceDto {
  @ApiProperty({
    description:
      'One id per submission. Sending it again returns the invoice already raised, never a second one.',
  })
  @IsUUID()
  submissionId!: string;

  @ApiPropertyOptional({
    description:
      "The client's first invoice only: Accounting creates the client's entity under this type.",
  })
  @IsOptional()
  @IsUUID()
  entityTypeId?: string;

  @ApiProperty()
  @IsUUID()
  transactionTypeId!: string;

  @ApiProperty({ description: 'Must equal the total of the lines' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999_999)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
