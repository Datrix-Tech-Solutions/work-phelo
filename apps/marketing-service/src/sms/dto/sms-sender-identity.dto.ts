import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SMS_SENDER_IDENTITY_STATUSES = [
  'DRAFT',
  'PENDING_PROVIDER_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'ARCHIVED',
] as const;

export const SMS_PROVIDER_VERIFICATION_STATUSES = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'UNKNOWN',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QuerySmsSenderIdentitiesDto {
  @ApiPropertyOptional({ enum: SMS_SENDER_IDENTITY_STATUSES })
  @IsOptional()
  @IsEnum(SMS_SENDER_IDENTITY_STATUSES)
  status?: (typeof SMS_SENDER_IDENTITY_STATUSES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}

export class CreateSmsSenderIdentityDto {
  @ApiProperty({ example: 'WORKPHELO', maxLength: 32 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  senderId!: string;

  @ApiPropertyOptional({ example: 'WorkPhelo campaigns', maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Marketing updates and campaign messages for customers',
    maxLength: 300,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  purpose?: string;

  @ApiPropertyOptional({ example: 'hubtel', maxLength: 80 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({ example: 'provider-sender-id-123', maxLength: 150 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  providerReference?: string;
}

export class UpdateSmsSenderIdentityDto {
  @ApiPropertyOptional({ example: 'WORKPHELO', maxLength: 32 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  senderId?: string;

  @ApiPropertyOptional({ example: 'WorkPhelo campaigns', maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Marketing updates and campaign messages for customers',
    maxLength: 300,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  purpose?: string;

  @ApiPropertyOptional({ example: 'hubtel', maxLength: 80 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({ example: 'provider-sender-id-123', maxLength: 150 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  providerReference?: string;
}

export class RejectSmsSenderIdentityDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReconcileSmsSenderProviderStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'SUSPENDED'] })
  @IsEnum(['APPROVED', 'REJECTED', 'SUSPENDED'])
  providerStatus!: 'APPROVED' | 'REJECTED' | 'SUSPENDED';

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  providerReferenceId?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class GrantSmsCreditsDto {
  @ApiProperty({ example: 1000, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  credits!: number;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class QuerySmsLedgerDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
