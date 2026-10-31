import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ProspectReferenceDto } from '../../prospects/dto/prospect-response.dto';
import {
  ProspectListMetaDto,
  ProspectListPrimaryContactDto,
} from '../../prospects/dto/query-prospects.dto';

export class ClientListPrimaryContactDto extends ProspectListPrimaryContactDto {
  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}

export class QueryClientsDto {
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

  @ApiPropertyOptional({
    example: 'Acme',
    description: 'Case-insensitive company-name search.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filter by assigned user. Only honoured for users with marketing.clients.all:VIEW.',
  })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description:
      'Inclusive lower created-at bound. Date-only values are interpreted as UTC midnight.',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description:
      'Inclusive upper created-at bound. Date-only values include the full UTC day.',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only clients that have this product or service.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only clients of this source type.',
  })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only clients of this business type.',
  })
  @IsOptional()
  @IsUUID()
  businessTypeId?: string;
}

export class ClientListProductDto {
  @ApiProperty({ description: 'CRM Settings product/service option ID.' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['PENDING', 'PURCHASED', 'UNINTERESTED'] })
  status!: string;
}

export class ClientListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  businessType!: ProspectReferenceDto | null;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  sourceType!: ProspectReferenceDto | null;

  @ApiPropertyOptional({ nullable: true })
  locationLabel!: string | null;

  @ApiProperty()
  isBillable!: boolean;

  @ApiProperty({
    example: '15000.00',
    description: 'Sum of the expected values on the client’s products.',
  })
  expectedValue!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the latest follow-up with the client took place.',
  })
  lastInteractionDate!: Date | null;

  @ApiProperty({
    description:
      'True once the client has its entity in Accounting (its first transaction was sent).',
  })
  hasAccountingEntity!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    example: '12500.00',
    description:
      'What Accounting has received for the client. Null when unavailable or not yet billed.',
  })
  achievedRevenue!: string | null;

  @ApiPropertyOptional({ nullable: true, type: ClientListPrimaryContactDto })
  primaryContact!: ClientListPrimaryContactDto | null;

  @ApiProperty({ type: [ClientListProductDto] })
  products!: ClientListProductDto[];

  @ApiProperty()
  assignedUserId!: string;

  @ApiPropertyOptional({ nullable: true })
  assignedUserName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  convertedFromProspectId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ClientListResponseDto {
  @ApiProperty({ type: [ClientListItemDto] })
  data!: ClientListItemDto[];

  @ApiProperty({ type: ProspectListMetaDto })
  meta!: ProspectListMetaDto;
}
