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

export class QueryProspectsDto {
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
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description:
      'Sales representative filter. Honored only for users with tenant-wide Prospect visibility.',
  })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'Only prospects currently in this sales pipeline stage.',
  })
  @IsOptional()
  @IsUUID()
  pipelineStageId?: string;
}

export class ProspectListProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProspectListDecisionMakerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProspectListPrimaryContactDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: ProspectListDecisionMakerDto,
  })
  decisionMaker!: ProspectListDecisionMakerDto | null;
}

export class ProspectListSalesStageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  probability!: number;
}

export class ProspectListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty({
    example: '10000.00',
    description: 'Sum of expected values from prospect products/services.',
  })
  expectedValue!: string;

  @ApiProperty({
    example: '2500.00',
    description: 'Sum of achieved values from prospect products/services.',
  })
  achievedValue!: string;

  @ApiProperty({ type: [ProspectListProductDto] })
  products!: ProspectListProductDto[];

  @ApiPropertyOptional({ nullable: true, type: ProspectListPrimaryContactDto })
  primaryContact!: ProspectListPrimaryContactDto | null;

  @ApiProperty({ type: ProspectListSalesStageDto })
  salesStage!: ProspectListSalesStageDto;

  @ApiProperty({
    example: 60,
    description:
      'Currently mirrors the configured sales-stage probability; no separate progress model exists yet.',
  })
  progress!: number;

  @ApiPropertyOptional({ nullable: true })
  lastInteractionDate!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Earliest expected close date among the prospect products/services.',
  })
  expectedCloseDate!: Date | null;

  @ApiProperty()
  assignedUserId!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class ProspectListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ProspectListResponseDto {
  @ApiProperty({ type: [ProspectListItemDto] })
  data!: ProspectListItemDto[];

  @ApiProperty({ type: ProspectListMetaDto })
  meta!: ProspectListMetaDto;
}
