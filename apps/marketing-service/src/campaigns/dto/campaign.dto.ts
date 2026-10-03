import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const CAMPAIGN_CHANNELS = ['SMS', 'EMAIL'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_DISPATCH_MODES = ['INSTANT', 'SCHEDULED'] as const;
export type CampaignDispatchMode = (typeof CAMPAIGN_DISPATCH_MODES)[number];

export const CAMPAIGN_STATUSES = [
  'PENDING_DISPATCH',
  'SCHEDULED',
  'SENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCampaignDto {
  @ApiProperty({ example: 'Q4 Product Launch', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: CAMPAIGN_CHANNELS, isArray: true, example: ['SMS'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(CAMPAIGN_CHANNELS, { each: true })
  channels!: CampaignChannel[];

  @ApiProperty({
    type: [String],
    description:
      'Prospect business types. Every prospect under any of them is contacted, through its primary contact.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  businessTypeIds!: string[];

  @ApiProperty({ example: 'Introducing our new product', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: CAMPAIGN_DISPATCH_MODES })
  @IsEnum(CAMPAIGN_DISPATCH_MODES)
  dispatchMode!: CampaignDispatchMode;

  @ApiPropertyOptional({
    example: '2026-10-20',
    description: 'Required when dispatchMode is SCHEDULED; today or later.',
  })
  @ValidateIf((dto: CreateCampaignDto) => dto.dispatchMode === 'SCHEDULED')
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduledDate must be YYYY-MM-DD',
  })
  scheduledDate?: string;
}

export class QueryCampaignsDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Matches the campaign name.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsEnum(CAMPAIGN_STATUSES)
  status?: CampaignStatus;
}

export class PreviewCampaignRecipientsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  businessTypeIds!: string[];

  @ApiProperty({ enum: CAMPAIGN_CHANNELS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(CAMPAIGN_CHANNELS, { each: true })
  channels!: CampaignChannel[];
}
