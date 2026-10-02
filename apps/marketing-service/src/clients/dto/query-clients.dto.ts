import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ProspectReferenceDto } from '../../prospects/dto/prospect-response.dto';
import {
  ProspectListMetaDto,
  ProspectListPrimaryContactDto,
} from '../../prospects/dto/query-prospects.dto';

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

  @ApiProperty()
  locationLabel!: string;

  @ApiProperty()
  isBillable!: boolean;

  @ApiPropertyOptional({ nullable: true, type: ProspectListPrimaryContactDto })
  primaryContact!: ProspectListPrimaryContactDto | null;

  @ApiProperty({ type: [ClientListProductDto] })
  products!: ClientListProductDto[];

  @ApiProperty()
  assignedUserId!: string;

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
