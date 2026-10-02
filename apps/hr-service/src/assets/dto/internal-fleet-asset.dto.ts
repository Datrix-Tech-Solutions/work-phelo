import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { AssetCondition, AssetStatus } from '../../../prisma/generated/client';

export class InternalTenantDto {
  @ApiProperty({ description: 'Tenant the request is made on behalf of' })
  @IsUUID()
  tenantId!: string;
}

export class InternalListVehicleAssetsQueryDto extends InternalTenantDto {
  @ApiPropertyOptional({
    description: 'Comma-separated asset IDs to restrict the result to',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id: string) => id.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class InternalCreateVehicleAssetDto extends InternalTenantDto {
  @ApiProperty({ example: 'Toyota Hilux' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: AssetCondition })
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class InternalUpdateVehicleAssetDto extends InternalTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ description: 'Pass null to clear the branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}

export class InternalVehicleStatusDto extends InternalTenantDto {
  @ApiProperty({
    enum: [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE, AssetStatus.RETIRED],
    description:
      'ASSIGNED is derived from driver assignment and cannot be set directly',
  })
  @IsIn([AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE, AssetStatus.RETIRED])
  status!:
    | typeof AssetStatus.AVAILABLE
    | typeof AssetStatus.MAINTENANCE
    | typeof AssetStatus.RETIRED;
}

export class InternalAssignVehicleDto extends InternalTenantDto {
  @ApiProperty({ description: 'Employee ID of the driver' })
  @IsUUID()
  employeeId!: string;
}
