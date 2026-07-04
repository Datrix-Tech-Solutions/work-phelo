import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  RecordStatus,
  SubledgerType,
} from '../../../prisma/generated/client';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateAccountingTenantConfigDto {
  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces?: number;
}

export class CreateAccountingCurrencyDto {
  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  code!: string;

  @ApiProperty({ example: 'Ghana Cedi' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'GH₵' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(10)
  symbol?: string;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces?: number;
}

export class UpdateAccountingCurrencyDto extends PartialType(
  CreateAccountingCurrencyDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExchangeRateDto {
  @ApiProperty({ example: 'USD' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  fromCurrency!: string;

  @ApiProperty({ example: 'GHS' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  toCurrency!: string;

  @ApiProperty({ example: 15.45, minimum: 0.00000001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rate!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  effectiveAt!: string;
}

export class UpdateExchangeRateDto {
  @ApiPropertyOptional({ example: 15.45, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  rate?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFiscalPeriodDto {
  @ApiProperty({ example: '2026-07' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  endDate!: string;
}

export class QueryFiscalPeriodsDto {
  @ApiPropertyOptional({ enum: FiscalPeriodStatus })
  @IsOptional()
  @IsEnum(FiscalPeriodStatus)
  status?: FiscalPeriodStatus;
}

export class CreateGLAccountDto {
  @ApiProperty({ example: '1100' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Cash at Bank' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: GLAccountCategory })
  @IsEnum(GLAccountCategory)
  category!: GLAccountCategory;

  @ApiProperty({ enum: NormalBalance })
  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowPosting?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateGLAccountDto extends PartialType(CreateGLAccountDto) {}

export class QueryGLAccountsDto {
  @ApiPropertyOptional({ enum: GLAccountCategory })
  @IsOptional()
  @IsEnum(GLAccountCategory)
  category?: GLAccountCategory;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class CreateCostCentreDto {
  @ApiProperty({ example: 'ACC' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Accra Branch' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Source module branch or department ID.',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;
}

export class UpdateCostCentreDto extends PartialType(CreateCostCentreDto) {}

export class CreateSubledgerAccountDto {
  @ApiProperty({ example: 'CED-0001' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Acme Insurance Company' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: SubledgerType })
  @IsEnum(SubledgerType)
  type!: SubledgerType;

  @ApiPropertyOptional({ description: 'Tenant-owned source record ID.' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  controlAccountId!: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateSubledgerAccountDto extends PartialType(
  CreateSubledgerAccountDto,
) {}

export class JournalLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  glAccountId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subledgerAccountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 100, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit?: number;
}

export class CreateJournalDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fiscalPeriodId!: string;

  @ApiProperty({ example: 'GHS' })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  transactionCurrency!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 0.00000001,
    description:
      'Required when transaction currency differs from base currency.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  sourceRecordType?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId?: string;

  @ApiProperty({ type: [JournalLineDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class UpdateDraftJournalDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  transactionCurrency?: string;

  @ApiPropertyOptional({ example: 1, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: [JournalLineDto], minItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}

export class ReverseJournalDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class QueryJournalsDto {
  @ApiPropertyOptional({ enum: JournalStatus })
  @IsOptional()
  @IsEnum(JournalStatus)
  status?: JournalStatus;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
