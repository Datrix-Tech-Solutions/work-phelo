import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  GLAccountCategory,
  PostingDirection,
  RuleLineSettlementKind,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateTaxTypeDto {
  @ApiProperty({ example: 'VAT' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Value Added Tax' })
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

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    description: 'Open-ended if omitted.',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Default account on the payables side: input tax on a bill, or tax withheld when paying a vendor. Null clears it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  payableAccountId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Default account on the receivables side: output tax on an invoice, or tax withheld by a customer. Null clears it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  receivableAccountId?: string | null;
}

export class UpdateTaxTypeDto extends PartialType(CreateTaxTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RuleLineScopeDto {
  @ApiProperty({ enum: GLAccountCategory })
  @IsEnum(GLAccountCategory)
  category!: GLAccountCategory;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Narrows the category to one classification. Omit to allow the whole category.',
  })
  @IsOptional()
  @IsUUID()
  classificationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Narrows it to one specific posting account (inside the category / classification).',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class TransactionTypeRuleLineDto {
  @ApiProperty({ enum: PostingDirection })
  @IsEnum(PostingDirection)
  direction!: PostingDirection;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'A fixed account. Omit on a Receivable/Payable main line that is scoped instead ' +
      '(`scopes`) — either a fixed account or at least one scope is required.',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    type: [RuleLineScopeDto],
    description:
      'Main line only: the categories / classifications the user picks one account from on the form. Several may be listed; the account may come from any of them.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleLineScopeDto)
  scopes?: RuleLineScopeDto[];

  @ApiPropertyOptional({
    enum: RuleLineSettlementKind,
    description:
      "Marks a line that applies when the bill/invoice is settled rather than when it is raised. A DEDUCTION reduces the cash that moves (discount, withholding tax); a CHARGE adds to it (bank charge). Needs a fixed account, and its side is fixed by the type's category.",
  })
  @IsOptional()
  @IsEnum(RuleLineSettlementKind)
  settlementKind?: RuleLineSettlementKind;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Set only on a tax line — the TaxType this line computes its amount from.',
  })
  @IsOptional()
  @IsUUID()
  taxTypeId?: string;

  @ApiPropertyOptional({
    example: 'CUSTOMER',
    description:
      "Set only when this line also posts to a party subledger (one of the tenant's Entity Types) under this account, rather than the account alone.",
  })
  @IsOptional()
  @IsString()
  subledgerType?: string;

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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Cashbook-posted RCPT/PMNT types only: the cash/bank account pre-selected on the New Transaction form for this type, still changeable there.',
  })
  @IsOptional()
  @IsUUID()
  defaultCashAccountId?: string;

  @ApiProperty({
    type: [TransactionTypeRuleLineDto],
    description:
      'At least 2 lines (one debit, one credit) for a Receivable/Payable document rule; exactly 1 line for the RCPT/PMNT cashbook types.',
  })
  @IsArray()
  @ArrayMinSize(1)
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
    format: 'uuid',
    description:
      'Cashbook-posted RCPT/PMNT types only: the cash/bank account pre-selected on the New Transaction form for this type, still changeable there.',
  })
  @IsOptional()
  @IsUUID()
  defaultCashAccountId?: string;

  @ApiPropertyOptional({
    type: [TransactionTypeRuleLineDto],
    description: 'When provided, replaces the rule’s lines entirely.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransactionTypeRuleLineDto)
  lines?: TransactionTypeRuleLineDto[];
}
