import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OmitType, PartialType, PickType, ApiProperty } from '@nestjs/swagger';
import {
  InventoryItemStatus,
  InventoryConfigurationStatus,
  StockLocationType,
  StockOutPurpose,
  PartyKind,
} from '../prisma/generated/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const decimal = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? String(value) : value;

export class NameDto {
  @ApiProperty({ example: 'Office' })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  name!: string;
}
export class ConfigurationDto extends NameDto {
  @ApiProperty({ required: false, default: 'ACTIVE', enum: InventoryConfigurationStatus })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(InventoryConfigurationStatus)
  status?: InventoryConfigurationStatus;
}
export class DescribedConfigurationDto extends ConfigurationDto {
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}
export class CategoryDto extends DescribedConfigurationDto {
  @ApiProperty({ required: false, nullable: true, type: String, maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  icon?: string | null;
}
export class UpdateCategoryDto extends PartialType(CategoryDto, { skipNullProperties: false }) {}
export class UnitDto extends DescribedConfigurationDto {
  @ApiProperty({
    required: false,
    maxLength: 10,
    description:
      'Send the chosen symbol. Omission preserves legacy clients with an identifier-derived fallback.',
  })
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 10)
  symbol?: string;
}
export class UpdateUnitDto extends PartialType(UnitDto, { skipNullProperties: false }) {}
export class LocationDto extends ConfigurationDto {
  @ApiProperty({ required: false, enum: StockLocationType, default: 'WAREHOUSE' })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(StockLocationType)
  type?: StockLocationType;

  @ApiProperty({
    required: false,
    maxLength: 50,
    description:
      'Trimmed uppercase tenant-unique code. Omission generates LOC-<id> for legacy clients.',
  })
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 50)
  code?: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  address?: string | null;
}
export class UpdateLocationDto extends PartialType(LocationDto, { skipNullProperties: false }) {}

export class ItemDto extends NameDto {
  @ApiProperty({ example: 'PAPER-001' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  sku!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
  @ApiProperty({ format: 'uuid', required: false, nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitOfMeasureId!: string;
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String, example: '12.5000' })
  @IsOptional()
  @Transform(decimal)
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false })
  @Matches(/^\d{1,14}(\.\d{1,4})?$/)
  costPrice?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(decimal)
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false })
  @Matches(/^\d{1,14}(\.\d{1,4})?$/)
  sellingPrice?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(decimal)
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false })
  @Matches(/^\d{1,14}(\.\d{1,4})?$/)
  reorderLevel?: string | null;

  @ApiProperty({ required: false, enum: InventoryItemStatus, default: 'ACTIVE' })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;
}
export class UpdateItemDto extends PartialType(ItemDto, { skipNullProperties: false }) {}

export class StockInDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
  @ApiProperty({ type: String, example: '1.2500' })
  @Transform(decimal)
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false })
  @Matches(/^(?=.*[1-9])\d{1,14}(\.\d{1,4})?$/)
  quantity!: string;
  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    maxLength: 100,
    description:
      "Name of one of the item's variants. Stock in creates the variant if the item doesn't have it yet; every other movement needs an existing one.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  variant?: string | null;
  @ApiProperty({ example: '2026-11-02', description: 'ISO date or date-time received' })
  @IsDateString({ strict: true })
  dateReceived!: string;

  @ApiProperty({ required: false, nullable: true, type: String, example: '12.5000' })
  @IsOptional()
  @Transform(decimal)
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false })
  @Matches(/^\d{1,14}(\.\d{1,4})?$/)
  unitCost?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  source?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  supplier?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string | null;
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class StockOutDto extends PickType(StockInDto, [
  'itemId',
  'locationId',
  'quantity',
  'variant',
  'reference',
  'notes',
] as const) {
  @ApiProperty({ example: '2026-11-02', description: 'ISO issue date or date-time' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ enum: StockOutPurpose, description: 'Required for every stock issue' })
  @IsEnum(StockOutPurpose)
  purpose!: StockOutPurpose;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipient?: string | null;
}

export enum StockAdjustmentType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export enum StockBalanceStatus {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class StockBalanceQueryDto {
  @ApiProperty({ required: false, enum: StockBalanceStatus })
  @IsOptional()
  @IsEnum(StockBalanceStatus)
  status?: StockBalanceStatus;
}

export class StockAdjustmentDto extends PickType(StockInDto, [
  'itemId',
  'locationId',
  'quantity',
  'variant',
  'reference',
  'notes',
] as const) {
  @ApiProperty({ enum: StockAdjustmentType })
  @IsEnum(StockAdjustmentType)
  type!: StockAdjustmentType;

  @ApiProperty({
    description: 'Code of one of the company adjustment reasons (see GET /adjustment-reasons)',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  reason!: string;

  @ApiProperty({ example: '2026-11-03', description: 'ISO adjustment date or date-time' })
  @IsDateString({ strict: true })
  date!: string;
}

export class StockTransferDto extends PickType(StockInDto, [
  'itemId',
  'quantity',
  'variant',
  'reference',
  'notes',
] as const) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceLocationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  destinationLocationId!: string;

  @ApiProperty({ example: '2026-11-02', description: 'ISO transfer date or date-time' })
  @IsDateString({ strict: true })
  date!: string;
}

// Batches: several items saved together as one movement. Every line is applied in one database
// transaction, so either all of them post or none do, and they share a batchId.
export const MAX_BATCH_LINES = 100;

const batchLines = (line: new () => object) =>
  applyDecorators(
    ApiProperty({ type: [line], minItems: 1, maxItems: MAX_BATCH_LINES }),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(MAX_BATCH_LINES),
    ValidateNested({ each: true }),
    Type(() => line),
  );

export class StockInLineDto extends PickType(StockInDto, [
  'itemId',
  'quantity',
  'variant',
  'unitCost',
] as const) {}
export class StockInBatchDto extends PickType(StockInDto, [
  'locationId',
  'dateReceived',
  'source',
  'supplier',
  'reference',
  'notes',
] as const) {
  @batchLines(StockInLineDto)
  lines!: StockInLineDto[];
}

export class StockLineDto extends PickType(StockInDto, [
  'itemId',
  'quantity',
  'variant',
] as const) {}
export class StockOutBatchDto extends PickType(StockOutDto, [
  'locationId',
  'date',
  'purpose',
  'recipient',
  'reference',
  'notes',
] as const) {
  @batchLines(StockLineDto)
  lines!: StockLineDto[];
}

export class StockTransferBatchDto extends PickType(StockTransferDto, [
  'sourceLocationId',
  'destinationLocationId',
  'date',
  'reference',
  'notes',
] as const) {
  @batchLines(StockLineDto)
  lines!: StockLineDto[];
}

export class StockAdjustmentBatchDto extends PickType(StockAdjustmentDto, [
  'locationId',
  'type',
  'reason',
  'date',
  'reference',
  'notes',
] as const) {
  @batchLines(StockLineDto)
  lines!: StockLineDto[];
}

export class PartyDto extends NameDto {
  @ApiProperty({ enum: PartyKind })
  @IsEnum(PartyKind)
  kind!: PartyKind;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  contactPerson?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  email?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  address?: string | null;

  @ApiProperty({ required: false, default: 'ACTIVE', enum: InventoryConfigurationStatus })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(InventoryConfigurationStatus)
  status?: InventoryConfigurationStatus;
}
export class UpdatePartyDto extends PartialType(OmitType(PartyDto, ['kind'] as const), {
  skipNullProperties: false,
}) {}
export class PartyQueryDto {
  @ApiProperty({ required: false, enum: PartyKind })
  @IsOptional()
  @IsEnum(PartyKind)
  kind?: PartyKind;
}

export class SubcategoryDto extends ConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
}
export class UpdateSubcategoryDto extends PartialType(ConfigurationDto) {}
export class SubcategoryQueryDto {
  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class VariantDto extends ConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;
}
export class UpdateVariantDto extends PartialType(ConfigurationDto) {}
export class VariantQueryDto {
  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class AdjustmentReasonDto extends ConfigurationDto {}
export class UpdateAdjustmentReasonDto extends PartialType(ConfigurationDto) {}
