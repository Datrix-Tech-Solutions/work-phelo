import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const SEGMENT_RECIPIENT_TYPES = ['PROSPECT', 'CLIENT'] as const;
export type SegmentRecipientType = (typeof SEGMENT_RECIPIENT_TYPES)[number];

const MAX_PICKED = 1000;
const MAX_FILTER_VALUES = 100;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/** What a segment is made of: filters, plus people always in or always out. */
export class SegmentRulesDto {
  @ApiPropertyOptional({
    enum: SEGMENT_RECIPIENT_TYPES,
    default: 'PROSPECT',
    description:
      'Who the segment holds. Fixed once saved. Sales stages and prospect picks apply to prospect segments; client picks apply to client segments.',
  })
  @IsOptional()
  @IsIn(SEGMENT_RECIPIENT_TYPES)
  recipientType?: SegmentRecipientType;

  @ApiPropertyOptional({
    type: [String],
    description: 'People with any of these business types.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  businessTypeIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      "People who have any of these products or services (CRM Settings product IDs). A client's uninterested products do not count.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Prospects at any of these sales (pipeline) stages.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  pipelineStageIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Prospects always included, whether or not the filters match.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PICKED)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  includeProspectIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Prospects always left out, even when the filters match.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PICKED)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  excludeProspectIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Client segments only: clients always included, whether or not the filters match.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PICKED)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  includeClientIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Client segments only: clients always left out, even when the filters match.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PICKED)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  excludeClientIds?: string[];
}

export class CreateSegmentDto extends SegmentRulesDto {
  @ApiProperty({ example: 'Insurance in negotiation', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateSegmentDto extends SegmentRulesDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
