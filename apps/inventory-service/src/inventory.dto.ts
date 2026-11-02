import { Transform } from 'class-transformer';
import {
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
} from 'class-validator';
import { PartialType, ApiProperty } from '@nestjs/swagger';
import { InventoryItemStatus, StockLocationType } from '../prisma/generated/client';

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
export class UpdateNameDto extends PartialType(NameDto, { skipNullProperties: false }) {}
export class LocationDto extends NameDto {
  @ApiProperty({ enum: StockLocationType })
  @IsEnum(StockLocationType)
  type!: StockLocationType;
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
