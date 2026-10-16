import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TenantStatusQuery {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum TenantSourceQuery {
  PLATFORM = 'PLATFORM',
  WEBSITE = 'WEBSITE',
}

export class QueryTenantsDto {
  @IsOptional()
  @IsEnum(TenantStatusQuery)
  status?: TenantStatusQuery;

  @IsOptional()
  @IsEnum(TenantSourceQuery)
  source?: TenantSourceQuery;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
