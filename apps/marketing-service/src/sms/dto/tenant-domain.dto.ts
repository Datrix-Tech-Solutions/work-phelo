import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const TENANT_DOMAIN_OWNERSHIP_STATUSES = [
  'UNVERIFIED',
  'VERIFIED',
  'REJECTED',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryTenantDomainsDto {
  @ApiPropertyOptional({ enum: TENANT_DOMAIN_OWNERSHIP_STATUSES })
  @IsOptional()
  @IsEnum(TENANT_DOMAIN_OWNERSHIP_STATUSES)
  ownershipStatus?: (typeof TENANT_DOMAIN_OWNERSHIP_STATUSES)[number];
}

export class CreateTenantDomainDto {
  @ApiProperty({ example: 'example.com', maxLength: 253 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  domain!: string;
}

export class TenantDomainDnsRecordDto {
  @ApiProperty({ example: 'TXT' })
  type!: 'TXT';

  @ApiProperty({ example: '_workphelo-verification.example.com' })
  host!: string;

  @ApiProperty({ example: 'workphelo-verification=token' })
  value!: string;
}

export class TenantDomainResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  domain!: string;

  @ApiProperty()
  normalizedDomain!: string;

  @ApiProperty({ enum: TENANT_DOMAIN_OWNERSHIP_STATUSES })
  ownershipStatus!: (typeof TENANT_DOMAIN_OWNERSHIP_STATUSES)[number];

  @ApiProperty({ type: TenantDomainDnsRecordDto })
  verificationRecord!: TenantDomainDnsRecordDto;

  @ApiProperty({ nullable: true })
  verifiedAt!: string | null;

  @ApiProperty({ nullable: true })
  lastCheckedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TenantDomainsListResponseDto {
  @ApiProperty({ type: [TenantDomainResponseDto] })
  items!: TenantDomainResponseDto[];
}

export class TenantDomainVerificationResponseDto extends TenantDomainResponseDto {
  @ApiProperty()
  verified!: boolean;

  @ApiPropertyOptional()
  reason?: string;
}
