import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PostingDirection,
  SubledgerType,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTaxTypeDto {
  @ApiProperty({ example: 'VAT' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    example: 12.5,
    description: 'Percentage rate, e.g. 12.5 for 12.5%.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTaxTypeDto extends PartialType(CreateTaxTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransactionTypeRuleLineDto {
  @ApiProperty({ enum: PostingDirection })
  @IsEnum(PostingDirection)
  direction!: PostingDirection;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Set only on a tax line — the TaxType this line computes its amount from.',
  })
  @IsOptional()
  @IsUUID()
  taxTypeId?: string;

  @ApiPropertyOptional({
    enum: SubledgerType,
    description:
      'Set only when this line also posts to a party subledger (Customer/Vendor/etc.) under this account, rather than the account alone.',
  })
  @IsOptional()
  @IsEnum(SubledgerType)
  subledgerType?: SubledgerType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateTransactionTypeRuleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  transactionTypeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [TransactionTypeRuleLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TransactionTypeRuleLineDto)
  lines!: TransactionTypeRuleLineDto[];
}

export class UpdateTransactionTypeRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    type: [TransactionTypeRuleLineDto],
    description: 'When provided, replaces the rule’s lines entirely.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TransactionTypeRuleLineDto)
  lines?: TransactionTypeRuleLineDto[];
}
